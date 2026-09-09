import asyncio
import json
import logging
from types import SimpleNamespace
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend import what3words as w

LAT, LNG = 51.521251, -0.203586
KEY = 'synthetic-secret-canary-not-a-real-key'

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('WHAT3WORDS_API_KEY', KEY)
    monkeypatch.setattr(w, 'budget', w.ConversionBudget())
    monkeypatch.setattr(w, 'provider_slots', asyncio.Semaphore(2))
    app = FastAPI()
    app.include_router(w.what3words_router, prefix='/api')
    return TestClient(app)

def lookup(client, **kwargs):
    return client.post('/api/what3words', json={'lat':LAT,'lng':LNG}, **kwargs)

def private(response, caplog):
    for value in (str(LAT),str(LNG),KEY):
        assert value not in caplog.text
        assert value not in response.text
    assert response.headers['cache-control']=='no-store'

def test_success_body_only_no_leaks(client,monkeypatch,caplog):
    caplog.set_level(logging.DEBUG)
    captured=[]
    def provider(*args):
        captured.append(args)
        return {'words':'filled.count.soap','nearestPlace':'London'}
    monkeypatch.setattr(w,'provider_lookup',provider)
    r=lookup(client)
    assert r.status_code==200
    assert captured==[(LAT,LNG,KEY)]
    assert r.json()=={'words':'filled.count.soap','nearestPlace':'London'}
    assert str(r.request.url)=='http://testserver/api/what3words'
    private(r,caplog)

@pytest.mark.parametrize('exception',[TimeoutError,RuntimeError,ValueError,OSError])
def test_error_message_traceback_and_url_not_logged(client,monkeypatch,caplog,exception):
    caplog.set_level(logging.DEBUG)
    def provider(*_):raise exception(f'https://api.what3words.com/?coordinates={LAT},{LNG}&key={KEY}')
    monkeypatch.setattr(w,'provider_lookup',provider)
    r=lookup(client)
    assert r.status_code==502
    assert r.json()=={'detail':'Unable to convert location'}
    private(r,caplog)

@pytest.mark.parametrize('body',[None,[],{}, {'lat':True,'lng':0},{'lat':'51.521251','lng':0},{'lat':91,'lng':0},{'lat':0,'lng':181},{'lat':0,'lng':0,'secret':KEY}])
def test_malformed_no_echo(client,caplog,body):
    caplog.set_level(logging.DEBUG)
    r=client.post('/api/what3words',content=json.dumps(body),headers={'Content-Type':'application/json'})
    assert r.status_code==400
    private(r,caplog)

@pytest.mark.parametrize('body',['{"lat":NaN,"lng":0}','{"lat":Infinity,"lng":0}','{"lat":','x'*257])
def test_nonfinite_invalid_oversize(client,caplog,body):
    r=client.post('/api/what3words',content=body,headers={'Content-Type':'application/json'})
    assert r.status_code in (400,413)
    private(r,caplog)

def test_missing_key(client,monkeypatch,caplog):
    monkeypatch.delenv('WHAT3WORDS_API_KEY')
    r=lookup(client)
    assert r.status_code==503
    private(r,caplog)

def test_origin_method_query_media(client):
    assert lookup(client,headers={'Origin':'https://attacker.invalid'}).status_code==403
    assert client.post('/api/what3words',content='{}').status_code==415
    assert client.get('/api/what3words').status_code==405
    assert client.post('/api/what3words?unexpected=1',json={'lat':0,'lng':0}).status_code==400

def test_rate_limits_expire_and_store_only_hashes_timestamps(client,monkeypatch):
    monkeypatch.setattr(w,'provider_lookup',lambda *_:{'words':'filled.count.soap','nearestPlace':None})
    for _ in range(6):assert lookup(client).status_code==200
    r=lookup(client)
    assert r.status_code==429 and r.headers['retry-after']=='60'
    assert all(isinstance(k,bytes) for k in w.budget.clients)
    assert all(isinstance(t,float) for ts in w.budget.clients.values() for t in ts)
    budget=w.ConversionBudget()
    for n in range(60):assert budget.allow(str(n),now=0)
    assert not budget.allow('next',now=0)
    assert budget.allow('next',now=61)
    assert len(budget.clients)==1

def test_busy(client,monkeypatch):
    monkeypatch.setattr(w,'provider_slots',asyncio.Semaphore(0))
    assert lookup(client).status_code==503

def test_chunked_limit():
    async def stream():
        yield b'x'*200
        yield b'x'*100
    with pytest.raises(OverflowError):asyncio.run(w.read_coordinates(SimpleNamespace(stream=stream)))

@pytest.mark.parametrize('status,payload',[
 (200,{'words':'filled.count.soap','nearestPlace':'London','coordinates':{'lat':LAT,'lng':LNG},'key':KEY}),
 (402,{'error':{'message':KEY}}),(200,{'words':KEY}),
 (200,{'words':'filled.count.soap','nearestPlace':KEY}),(200,{'words':'x'*20000})])
def test_outbound_adapter_no_log_no_secret_redirect(monkeypatch,caplog,status,payload):
    caplog.set_level(logging.DEBUG)
    class Response:
        def __enter__(self):return self
        def __exit__(self,*_):pass
        def read(self,limit):return json.dumps(payload).encode()[:limit]
    Response.status=status
    class Opener:
        def open(self,request,timeout):
            assert timeout==15 and request.get_header('X-api-key')==KEY
            assert 'coordinates=' in request.full_url
            return Response()
    def build(handler):
        assert isinstance(handler,w.NoRedirect)
        return Opener()
    monkeypatch.setattr(w,'build_opener',build)
    if status==200 and 'coordinates' in payload:
        assert set(w.provider_lookup(LAT,LNG,KEY))=={'words','nearestPlace'}
    else:
        with pytest.raises(ValueError,match='Provider unavailable'):w.provider_lookup(LAT,LNG,KEY)
    for value in (str(LAT),str(LNG),KEY):assert value not in caplog.text
    assert w.NoRedirect().redirect_request(None,None,302,'',{},'https://attacker.invalid') is None


def test_uvicorn_access_and_application_logs_do_not_contain_location_or_key(tmp_path):
    import os
    from pathlib import Path
    import socket
    import subprocess
    import sys
    import time
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError, URLError
    module=tmp_path/'private_app.py'
    module.write_text('''from fastapi import FastAPI
from backend import what3words as w
app=FastAPI()
app.include_router(w.what3words_router,prefix='/api')
def provider(lat,lng,key):
    if lat < 0: raise RuntimeError(str(lat)+str(lng)+key)
    return {'words':'filled.count.soap','nearestPlace':'London'}
w.provider_lookup=provider
''')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    log=tmp_path/'server.log'
    env={**os.environ,'WHAT3WORDS_API_KEY':KEY,'PYTHONPATH':str(Path(__file__).resolve().parents[1])+os.pathsep+str(tmp_path)}
    with log.open('w') as output:
        proc=subprocess.Popen([sys.executable,'-m','uvicorn','private_app:app','--port',str(port),'--host','127.0.0.1','--log-level','debug'],env=env,stdout=output,stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                try:
                    with urlopen(f'http://127.0.0.1:{port}/openapi.json',timeout=1):break
                except URLError:time.sleep(.05)
            for lat,status in [(LAT,200),(-LAT,502)]:
                req=__import__('urllib.request',fromlist=['Request']).Request(f'http://127.0.0.1:{port}/api/what3words',data=json.dumps({'lat':lat,'lng':LNG}).encode(),headers={'Content-Type':'application/json'},method='POST')
                try:
                    with urlopen(req,timeout=5) as response:assert response.status==status
                except HTTPError as error:assert error.code==status
        finally:
            proc.terminate();proc.wait(timeout=10)
    text=log.read_text()
    assert 'POST /api/what3words HTTP/1.1' in text
    for value in (str(LAT),str(-LAT),str(LNG),KEY,'coordinates=','Traceback'):assert value not in text
