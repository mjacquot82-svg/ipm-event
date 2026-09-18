from backend.platform_services import normalize_wonderpush_statistics


def test_provider_202_is_acceptance_not_delivery():
    # The HTTP status is handled by WonderPushClient; normalized statistics are
    # intentionally separate and remain unknown until the provider reports them.
    assert normalize_wonderpush_statistics({"data": []}) == {
        "provider_sent_count": None,
        "provider_confirmed_receipt_count": None,
        "provider_failure_count": None,
        "provider_open_count": None,
    }


def test_statistics_normalization_preserves_unknowns_and_maps_provider_events():
    result = normalize_wonderpush_statistics({"data": [{"counters": [
        {"type": "@NOTIFICATION_SENT", "count": 3},
        {"type": "@NOTIFICATION_OPENED", "count": 2},
        {"type": "@NOTIFICATION_RECEIVED", "count": 1},
    ]}]})
    assert result["provider_sent_count"] == 3
    assert result["provider_open_count"] == 2
    assert result["provider_confirmed_receipt_count"] == 1
    assert result["provider_failure_count"] is None


def test_historical_delivery_without_campaign_identity_is_not_queryable():
    assert normalize_wonderpush_statistics({})["provider_sent_count"] is None
