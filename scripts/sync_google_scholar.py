#!/usr/bin/env python3
"""Fetch a public Google Scholar profile and write portfolio publication data."""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


PROFILE_ID = "6227iqYAAAAJ"
PROFILE_URL = (
    "https://scholar.google.com/citations"
    f"?user={PROFILE_ID}&hl=en&pagesize=100&sortby=pubdate"
)


def normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.casefold()).strip()


KNOWN_METADATA = {
    normalize_title(
        "Vision-guided gripping process with minimizing folding for flexible "
        "fabric materials by integrating a sequential optimization algorithm "
        "and FEM analysis"
    ): {
        "doiUrl": "https://doi.org/10.1016/j.robot.2026.105349",
        "badge": "Q1 Journal",
        "venueOverride": "Robotics and Autonomous Systems, 198, 105349",
    },
    normalize_title(
        "Data-Driven Vision and FEM-Based Sequential Optimization for "
        "Fold-Minimized Robotic Fabric Gripping"
    ): {
        "doiUrl": "https://doi.org/10.1109/BigData66926.2025.11400823",
        "badge": "CORE B Ranked",
        "venueOverride": (
            "2025 IEEE International Conference on Big Data (BigData), "
            "2616-2618"
        ),
    },
    normalize_title(
        "Structural Modifications for Vibration-Assisted Spin Coating: "
        "Enhancing Coating Thickness Uniformity"
    ): {
        "doiUrl": "https://doi.org/10.1007/978-3-031-90629-9_37",
        "badge": "Best Paper Award",
        "venueOverride": (
            "EAI International Conference on Renewable Energy and "
            "Sustainable Manufacturing"
        ),
    },
}


class ScholarProfileParser(HTMLParser):
    """Extract publication rows from Google Scholar's public profile HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.profile_name = ""
        self.publications: list[dict[str, object]] = []
        self._row: dict[str, object] | None = None
        self._gray_count = 0
        self._capture_key: str | None = None
        self._capture_depth = 0
        self._capture_text: list[str] = []

    @staticmethod
    def _attributes(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key: value or "" for key, value in attrs}

    def _start_capture(self, key: str) -> None:
        self._capture_key = key
        self._capture_depth = 1
        self._capture_text = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        attributes = self._attributes(attrs)
        classes = set(attributes.get("class", "").split())

        if self._capture_key:
            self._capture_depth += 1
            return

        if tag == "div" and attributes.get("id") == "gsc_prf_in":
            self._start_capture("profile_name")
            return

        if tag == "tr" and "gsc_a_tr" in classes:
            self._row = {}
            self._gray_count = 0
            return

        if self._row is None:
            return

        if tag == "a" and "gsc_a_at" in classes:
            self._row["scholarUrl"] = urljoin(
                "https://scholar.google.com", attributes.get("href", "")
            )
            self._start_capture("title")
        elif tag == "div" and "gs_gray" in classes:
            key = "authors" if self._gray_count == 0 else "venue"
            self._gray_count += 1
            self._start_capture(key)
        elif tag == "span" and "gsc_a_hc" in classes:
            self._start_capture("year")
        elif tag == "a" and "gsc_a_ac" in classes:
            self._start_capture("citations")

    def handle_data(self, data: str) -> None:
        if self._capture_key:
            self._capture_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._capture_key:
            self._capture_depth -= 1
            if self._capture_depth == 0:
                value = " ".join("".join(self._capture_text).split())
                if self._capture_key == "profile_name":
                    self.profile_name = value
                elif self._row is not None:
                    self._row[self._capture_key] = value
                self._capture_key = None
                self._capture_text = []
            return

        if tag == "tr" and self._row is not None:
            if self._row.get("title"):
                self.publications.append(self._row)
            self._row = None


def fetch_profile(max_attempts: int = 3) -> str:
    headers = {
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "Chrome/124.0 Safari/537.36"
        ),
    }
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            request = Request(PROFILE_URL, headers=headers)
            with urlopen(request, timeout=30) as response:
                if response.status != 200:
                    raise RuntimeError(f"Google Scholar returned HTTP {response.status}")
                return response.read().decode("utf-8", errors="replace")
        except (HTTPError, URLError, TimeoutError, RuntimeError) as error:
            last_error = error
            if attempt < max_attempts:
                time.sleep(attempt * 2)

    raise RuntimeError(f"Unable to fetch Google Scholar: {last_error}")


def publication_kind(venue: str) -> str:
    venue_lower = venue.casefold()
    conference_terms = (
        "conference",
        "proceedings",
        "symposium",
        "congress",
        "workshop",
    )
    return "conference" if any(term in venue_lower for term in conference_terms) else "journal"


def clean_publication(raw: dict[str, object]) -> dict[str, object]:
    title = str(raw.get("title", "")).strip()
    year = str(raw.get("year", "")).strip()
    venue = str(raw.get("venue", "")).strip()
    if year:
        venue = re.sub(rf"\s*,?\s*{re.escape(year)}\s*$", "", venue).strip(" ,")

    metadata = KNOWN_METADATA.get(normalize_title(title), {})
    display_venue = str(metadata.get("venueOverride", venue))
    citation_text = str(raw.get("citations", "")).strip()
    citations = int(citation_text) if citation_text.isdigit() else 0

    publication: dict[str, object] = {
        "title": title,
        "authors": str(raw.get("authors", "")).strip(),
        "venue": display_venue,
        "year": int(year) if year.isdigit() else None,
        "citations": citations,
        "kind": publication_kind(display_venue),
        "scholarUrl": str(raw.get("scholarUrl", "")).strip(),
    }
    for key in ("doiUrl", "badge"):
        if metadata.get(key):
            publication[key] = metadata[key]
    return publication


def build_payload(html: str) -> dict[str, object]:
    parser = ScholarProfileParser()
    parser.feed(html)

    if parser.profile_name != "Minh Khang Ngo":
        raise RuntimeError(
            "Scholar profile identity check failed; refusing to replace existing data"
        )
    if not parser.publications:
        raise RuntimeError(
            "No publication rows found; Google may have returned a bot-check page"
        )

    publications = [clean_publication(item) for item in parser.publications]
    publications.sort(
        key=lambda item: (int(item.get("year") or 0), str(item.get("title", ""))),
        reverse=True,
    )
    return {
        "profileName": parser.profile_name,
        "profileUrl": f"https://scholar.google.com/citations?user={PROFILE_ID}&hl=en",
        "lastSyncedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "publicationCount": len(publications),
        "publications": publications,
    }


def write_json_atomic(output_path: Path, payload: dict[str, object]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{output_path.name}.", dir=output_path.parent, text=True
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary_name, output_path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def main() -> None:
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/publications.json"),
        help="Destination JSON file",
    )
    args = argument_parser.parse_args()

    payload = build_payload(fetch_profile())
    write_json_atomic(args.output, payload)
    print(f"Synced {payload['publicationCount']} publications to {args.output}")


if __name__ == "__main__":
    main()
