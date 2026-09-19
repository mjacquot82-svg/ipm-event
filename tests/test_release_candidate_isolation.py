import ast
import json
from pathlib import Path
import subprocess
from backend import server
from fastapi import HTTPException
import pytest
ROOT=Path(__file__).resolve().parents[1]
MAIN='5c41f907821cf11be9c3140d8b8c275c0f9b5c29'
STAGING='d7575f6d4eb8a9dd4730b317c182e0f91450f670'

def original(ref,path):return subprocess.check_output(['git','show',ref+':'+path],cwd=ROOT)

def test_no_staging_targeting_or_preview_controls():
    for folder in ['backend','frontend/app','frontend/src','supabase/migrations']:
        for p in (ROOT/folder).rglob('*'):
            if p.suffix not in ['.py','.tsx','.ts','.sql']:continue
            source=p.read_text()
            for token in ['STAGING_T30','controlled_fixture_id','controlled test deliveries','controlled_arm','test_device_label','Arm reminder test','synthetic_events','Device A','previewWalkthrough=', 'def simulate_load(', 'def simulate_batched_load(']:
                assert token not in source,(p,token)
    assert 'return false' in (ROOT/'frontend/src/components/MapEducation.tsx').read_text().split('export function useWalkthroughPreview()')[1].split('\n')[0]


def test_t30_cannot_be_activated_by_environment():
    tree=ast.parse((ROOT/'backend/server.py').read_text())
    for name in ['ITINERARY_REMINDER_DELIVERY_ENABLED','ITINERARY_REMINDER_SCHEDULER_ENABLED']:
        assignments=[n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in n.targets)]
        assert len(assignments)==1 and isinstance(assignments[0].value,ast.Constant) and assignments[0].value.value is False
    assert not any('/controlled' in r.path or '/arm' in r.path for r in server.app.routes)


def test_existing_main_features_and_map_geometry_preserved():
    for path in ['frontend/app/(tabs)/index.tsx','frontend/app/(tabs)/about.tsx','frontend/app/(tabs)/emergency-services.tsx','backend/what3words.py','frontend/src/config/tentedCitySemanticMap.ts','frontend/src/data/tentedCityVendors.ts','frontend/src/data/tentedCityVendorsPart1.ts','frontend/src/data/tentedCityVendorsPart2.ts','frontend/src/data/tentedCityVendorsPart3.ts','frontend/src/data/tentedCityVendorsConsolidated.ts','frontend/src/config/mapInteraction.ts','frontend/public/webpushr-sw.js']:
        assert (ROOT/path).read_bytes()==original(MAIN,path),path
    for path in ['frontend/src/config/tentedCityParadeRoutes.ts','frontend/src/components/ParadeRouteOverlay.ts','frontend/src/components/ParadeRouteOverlay.tsx']:
        if (ROOT/path).exists():assert (ROOT/path).read_bytes()==original(STAGING,path),path


def test_catalog_changes_are_only_eleven_labels_with_all_ids_preserved():
    before=json.loads(original(MAIN,'frontend/public/api/vendors.json'))['vendors']
    after=json.loads((ROOT/'frontend/public/api/vendors.json').read_text())['vendors']
    assert [r['id'] for r in before]==[r['id'] for r in after]
    changed=[]
    for old,new in zip(before,after):
        if old!=new:
            assert {**old,'location':'Indoors at the Artisan Tent'}==new
            changed.append(new)
    assert len(changed)==11
    for term in ['Fellowship of Christian Farmers','Mitchell Cycle','Bailey Repair','B Town Farm','JW Custom Fab']:
        assert [r for r in before if term in r['name']]==[r for r in after if term in r['name']]


def test_legacy_content_source_returns_unavailable_instead_of_name_error(monkeypatch):
    monkeypatch.setattr(server,'itinerary_reminder_repository',None)
    with pytest.raises(HTTPException) as e:server.require_itinerary_reminder_repository()
    assert e.value.status_code==503


def test_render_backend_directory_imports_are_supported():
    result=subprocess.run(['python','-c',"import asyncio; import notification_overview; from platform_services import WonderPushClient, WonderPushError\ntry: asyncio.run(WonderPushClient(access_token='local-placeholder').get_campaign_statistics(''))\nexcept WonderPushError: pass\n"],cwd=ROOT/'backend',capture_output=True,text=True)
    assert result.returncode==0,result.stderr
