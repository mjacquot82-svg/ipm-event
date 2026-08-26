from copy import deepcopy
import asyncio

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


class _DemoCollection:
    def __init__(self):
        self.document = None

    async def find_one(self, _query):
        return deepcopy(self.document)

    async def insert_one(self, document):
        self.document = deepcopy(document)

    async def replace_one(self, _query, document, upsert=False):
        assert upsert is True
        self.document = deepcopy(document)


class _DemoDatabase:
    def __init__(self):
        self.plowing_results_demo = _DemoCollection()


def test_publish_is_visible_to_attendee_then_reset_restores_clean_demo(monkeypatch):
    import server

    database = _DemoDatabase()
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "IS_STAGING_DEPLOYMENT", True)
    classes = deepcopy(DEMO_CLASSES)
    classes[1]["groups"][0]["competitors"][-1]["points"] = 600

    published = asyncio.run(server.publish_admin_plowing_results_demo(
        DemoResultsPayload(classes=classes),
        {"role": "Owner", "username": "meeting-organizer"},
    ))
    attendee = asyncio.run(server.get_plowing_results_demo())
    assert published["classes"][1]["groups"][0]["competitors"][0]["id"] == "c5g1-8"
    assert attendee["classes"][1]["groups"][0]["competitors"][0]["points"] == 600

    reset = asyncio.run(server.reset_admin_plowing_results_demo(
        {"role": "Owner", "username": "meeting-organizer"}
    ))
    assert reset["classes"][1]["groups"][0]["competitors"][0]["id"] == "c5g1-1"
    assert reset["updated_by"] == "meeting-organizer"
