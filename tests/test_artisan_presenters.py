from backend.prepare_artisan_presenters import desired_rows, staging_sql, EVENT_ID

def test_confirmed_occurrences_and_unknown_end_times():
    rows = desired_rows()
    assert len(rows) == 8
    susan = [r for r in rows if r['description'] == 'Presenter: Susan Sietz']
    assert {r['starts_at'] for r in susan} == {f'2026-09-{d}T14:00:00-04:00' for d in (22,24,25,26)}
    assert {r['title'] for r in susan} == {'Wool Painting with fibre'}
    expected = {
        'Long ago Cures': ('2026-09-23T13:00:00-04:00', 'Wednesday', 'Shannon Woods'),
        'Greenock Swamp Tours': ('2026-09-25T13:00:00-04:00', 'Friday', 'Shannon Woods'),
        'Her Experiences as Queen of the Furrow': ('2026-09-22T14:30:00-04:00','Tuesday','Victoria Kolb - Queen of the Furrow'),
        'Wild Side Art Gallery - my sketches': ('2026-09-24T13:30:00-04:00','Thursday','Ken Thornburn'),
    }
    for title,(start,day,presenter) in expected.items():
        [row] = [r for r in rows if r['title'] == title]
        assert (row['starts_at'],row['days_active'],row['description']) == (start,day,f'Presenter: {presenter}')
    assert all(r['ends_at'] is None and r['status']=='published' and r['location_name']=='Artisan Tent Presentation Area' for r in rows)
    assert not any('Angie' in str(r) or '10:30' in str(r) for r in rows)

def test_stable_unique_identities_and_no_existing_record_updates():
    first = desired_rows()
    assert first == desired_rows()
    assert len({r['id'] for r in first}) == len({r['external_id'] for r in first}) == 8
    assert {r['event_id'] for r in first} == {EVENT_ID}
    sql = staging_sql()
    assert 'ON CONFLICT DO NOTHING' in sql
    assert 'UPDATE public.' not in sql and 'DELETE' not in sql
    assert "slug='ipm-staging'" in sql and "slug='ipm-2026'" in sql
    assert 'Existing schedule changed: re-audit before applying' in sql
    assert 'Unrelated schedule record changed' in sql
