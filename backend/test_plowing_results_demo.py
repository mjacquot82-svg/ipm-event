from copy import deepcopy

import pytest
from pydantic import ValidationError

from plowing_results_demo import DEMO_CLASSES, DemoResultsPayload, demo_document, ranked_document, validated_document


def test_demo_structure_is_isolated_and_realistic():
    document = ranked_document(demo_document())
    assert document["id"] == "ipm-plowing-results-demo-v1"
    assert document["event_id"] == "ipm-2026-demo"
    assert document["demo"] is True
    assert [(item["name"], [group["name"] for group in item["groups"]]) for item in document["classes"]] == [
        ("Class 2", ["Group 1", "Group 2"]),
        ("Class 5", ["Group 1", "Group 2"]),
        ("Class 6", ["Group 1"]),
    ]
    primary = document["classes"][1]["groups"][0]
    assert len(primary["competitors"]) == 8
    assert [item["position"] for item in primary["competitors"]] == list(range(1, 9))


def test_higher_points_reorders_and_ties_are_deterministic():
    document = demo_document()
    group = document["classes"][1]["groups"][0]
    group["competitors"][7]["points"] = 600
    ranked = ranked_document(document)["classes"][1]["groups"][0]["competitors"]
    assert ranked[0]["id"] == "c5g1-8"
    ranked[0]["points"] = ranked[1]["points"]
    tied = ranked_document({**document, "classes": deepcopy(document["classes"])})
    assert tied["demo"] is True


@pytest.mark.parametrize("mutation", ["blank", "invalid_points", "duplicate", "empty_group"])
def test_publication_validation_rejects_obvious_mistakes(mutation):
    classes = deepcopy(DEMO_CLASSES)
    competitors = classes[0]["groups"][0]["competitors"]
    if mutation == "blank":
        competitors[0]["name"] = "  "
    elif mutation == "invalid_points":
        competitors[0]["points"] = -1
    elif mutation == "duplicate":
        competitors[1]["name"] = competitors[0]["name"]
    else:
        classes[0]["groups"][0]["competitors"] = []
    with pytest.raises(ValidationError):
        DemoResultsPayload(classes=classes)


def test_valid_publication_remains_demo_scoped():
    payload = DemoResultsPayload(classes=deepcopy(DEMO_CLASSES))
    document = validated_document(payload, "meeting-organizer")
    assert document["updated_by"] == "meeting-organizer"
    assert document["event_id"] == "ipm-2026-demo"
    assert document["source"] == "manual-demo-editor"
