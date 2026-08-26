from copy import deepcopy
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


ResultStatus = Literal["In Progress", "Provisional", "Final"]
DAYS = ("Tue", "Wed", "Thu", "Fri")


class DemoCompetitor(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    town: str = Field(min_length=1, max_length=120)
    points: float = Field(ge=0, le=1000)
    status: ResultStatus = "Provisional"
    daily: dict[str, float | None] = Field(default_factory=dict)

    @field_validator("name", "town")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("daily")
    @classmethod
    def validate_daily_scores(cls, value: dict[str, float | None]):
        if any(day not in DAYS for day in value):
            raise ValueError("daily scores may only use Tue, Wed, Thu, and Fri")
        if any(score is not None and (score < 0 or score > 1000) for score in value.values()):
            raise ValueError("daily scores must be between 0 and 1000")
        return {day: value.get(day) for day in DAYS}


class DemoGroup(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    status: ResultStatus = "Provisional"
    competitors: list[DemoCompetitor] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_unique_competitors(self):
        ids = [competitor.id.casefold() for competitor in self.competitors]
        names = [competitor.name.casefold() for competitor in self.competitors]
        if len(ids) != len(set(ids)) or len(names) != len(set(names)):
            raise ValueError("competitors in a group must have unique names and identifiers")
        return self


class DemoClass(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    groups: list[DemoGroup] = Field(min_length=1, max_length=20)


class DemoResultsPayload(BaseModel):
    classes: list[DemoClass] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def validate_unique_structure(self):
        class_ids = [item.id.casefold() for item in self.classes]
        if len(class_ids) != len(set(class_ids)):
            raise ValueError("class identifiers must be unique")
        for item in self.classes:
            group_ids = [group.id.casefold() for group in item.groups]
            if len(group_ids) != len(set(group_ids)):
                raise ValueError("group identifiers must be unique within each class")
        return self


def _competitor(identifier, name, town, points, daily, status="Provisional"):
    return {"id": identifier, "name": name, "town": town, "points": points,
            "daily": dict(zip(DAYS, daily)), "status": status}


DEMO_CLASSES = [
    {"id": "class-2", "name": "Class 2", "groups": [
        {"id": "group-1", "name": "Group 1", "status": "Provisional", "competitors": [
            _competitor("c2g1-1", "Morgan MacLeod", "Lucknow", 466.5, [116.0, 117.5, 115.0, 118.0]),
            _competitor("c2g1-2", "Casey Van Dyk", "Clinton", 459.0, [113.5, 116.0, 114.5, 115.0]),
            _competitor("c2g1-3", "Taylor McBride", "Arthur", 452.5, [112.0, 113.5, 112.5, 114.5]),
            _competitor("c2g1-4", "Jamie Rutledge", "Listowel", 448.0, [111.0, 112.0, 111.5, 113.5]),
        ]},
        {"id": "group-2", "name": "Group 2", "status": "In Progress", "competitors": [
            _competitor("c2g2-1", "Avery Campbell", "Seaforth", 348.5, [114.0, 117.0, 117.5, None], "In Progress"),
            _competitor("c2g2-2", "Riley Ferguson", "Elmira", 344.0, [112.5, 115.5, 116.0, None], "In Progress"),
            _competitor("c2g2-3", "Parker Johnston", "Wingham", 339.5, [111.0, 113.0, 115.5, None], "In Progress"),
            _competitor("c2g2-4", "Quinn Douglas", "Mitchell", 334.0, [109.5, 111.5, 113.0, None], "In Progress"),
        ]},
    ]},
    {"id": "class-5", "name": "Class 5", "groups": [
        {"id": "group-1", "name": "Group 1", "status": "Provisional", "competitors": [
            _competitor("c5g1-1", "Alex Martin", "Owen Sound", 487.5, [121.0, 122.5, 120.5, 123.5]),
            _competitor("c5g1-2", "Jordan Evans", "Tiverton", 481.0, [119.5, 121.0, 119.0, 121.5]),
            _competitor("c5g1-3", "Chris Miller", "Walkerton", 476.5, [118.0, 119.5, 118.5, 120.5]),
            _competitor("c5g1-4", "Sam O'Connor", "Harriston", 472.0, [117.5, 118.0, 117.0, 119.5]),
            _competitor("c5g1-5", "Drew Thompson", "Paisley", 468.5, [116.0, 117.5, 116.5, 118.5]),
            _competitor("c5g1-6", "Cameron Reid", "Mount Forest", 463.0, [115.0, 116.0, 115.5, 116.5]),
            _competitor("c5g1-7", "Robin MacDonald", "Chesley", 458.5, [113.5, 115.0, 114.0, 116.0]),
            _competitor("c5g1-8", "Leslie Grant", "Kincardine", 454.0, [112.5, 113.5, 113.0, 115.0]),
        ]},
        {"id": "group-2", "name": "Group 2", "status": "Final", "competitors": [
            _competitor("c5g2-1", "Devin Wallace", "Fergus", 479.0, [119.0, 120.0, 119.0, 121.0], "Final"),
            _competitor("c5g2-2", "Sydney Morrison", "Brussels", 474.5, [117.5, 119.0, 118.0, 120.0], "Final"),
            _competitor("c5g2-3", "Reese Patterson", "Hanover", 469.0, [116.5, 117.0, 116.5, 119.0], "Final"),
            _competitor("c5g2-4", "Blair McKenzie", "Teeswater", 461.5, [114.0, 116.0, 115.0, 116.5], "Final"),
        ]},
    ]},
    {"id": "class-6", "name": "Class 6", "groups": [
        {"id": "group-1", "name": "Group 1", "status": "In Progress", "competitors": [
            _competitor("c6g1-1", "Rowan Sinclair", "Exeter", 239.5, [119.0, 120.5, None, None], "In Progress"),
            _competitor("c6g1-2", "Hayden Stewart", "Goderich", 236.0, [117.0, 119.0, None, None], "In Progress"),
            _competitor("c6g1-3", "Emerson Clark", "Palmerston", 232.5, [115.5, 117.0, None, None], "In Progress"),
            _competitor("c6g1-4", "Finley Ross", "Mildmay", 229.0, [113.5, 115.5, None, None], "In Progress"),
        ]},
    ]},
]


def demo_document(updated_by="demo-reset"):
    return {
        "id": "ipm-plowing-results-demo-v1",
        "event_id": "ipm-2026-demo",
        "demo": True,
        "source": "manual-demo-editor",
        "ranking_rule": "Higher points rank first; demo ties sort alphabetically by competitor name.",
        "last_updated": datetime.now(timezone.utc),
        "updated_by": updated_by,
        "classes": deepcopy(DEMO_CLASSES),
    }


def ranked_document(document: dict) -> dict:
    result = deepcopy(document)
    for competition_class in result["classes"]:
        for group in competition_class["groups"]:
            group["competitors"] = sorted(
                group["competitors"], key=lambda item: (-float(item["points"]), item["name"].casefold())
            )
            for index, competitor in enumerate(group["competitors"], start=1):
                competitor["position"] = index
    result.pop("_id", None)
    return result


def validated_document(payload: DemoResultsPayload, updated_by: str) -> dict:
    document = demo_document(updated_by)
    document["classes"] = payload.model_dump()["classes"]
    return ranked_document(document)
