"""Run local tests with live credentials removed and socket connections prohibited."""
import os
import socket
import sys
from pathlib import Path

for key in list(os.environ):
    if any(part in key.upper() for part in ('SUPABASE', 'MONGO', 'WONDERPUSH', 'WEBPUSHR', 'DATABASE_URL')):
        os.environ.pop(key)
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

def deny_network(*args, **kwargs):
    raise RuntimeError('F02 local tests prohibit network connections')

socket.socket.connect = deny_network
import pytest
raise SystemExit(pytest.main(['-q', '-p', 'no:cacheprovider', *sys.argv[1:]]))
