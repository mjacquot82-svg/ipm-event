from backend.prepare_artisan_resolution import desired_rows, staging_sql
from backend.prepare_artisan_presenters import desired_rows as original_eight

def test_only_resolved_angie_occurrence_and_stable_identity():
    [r] = desired_rows()
    assert r['title'] == 'Flossie Mae Hats - & Feather Farmer Hats'
    assert r['description'] == 'Presenter: Angie Smith-Eckensweiler'
    assert r['starts_at'] == '2026-09-23T14:00:00-04:00'
    assert r['days_active'] == 'Wednesday'
    assert r['location_name'] == 'Artisan Tent Presentation Area'
    assert r['ends_at'] is None and r['status'] == 'published'
    assert desired_rows() == [r]
    assert r['id'] not in {v['id'] for v in original_eight()}
    assert len(original_eight()) == 8

def test_insert_only_guard_preserves_all_existing_occurrences():
    sql = staging_sql()
    assert '3ae840a54cf69eb0d50cdc7896efe71c' in sql
    assert 'ON CONFLICT DO NOTHING' in sql
    assert 'UPDATE public.' not in sql and 'DELETE' not in sql
    assert "slug='ipm-staging'" in sql
    assert 'Unrelated schedule record changed' in sql
    assert '<> 1' in sql
