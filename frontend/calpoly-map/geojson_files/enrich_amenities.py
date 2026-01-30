#!/usr/bin/env python3
"""Enrich buildings.geojson with amenity fields based on building names."""

import json
import re


def infer_amenity(name, building_type=None):
    """Infer amenity type from building name and type."""
    if not name:
        return None

    name_lower = name.lower()

    # Engineering buildings
    if any(word in name_lower for word in [
        'engineering', 'graphical arts', 'bonderson'
    ]):
        return 'engineering_building'

    # Computer Science
    if 'computer science' in name_lower or 'baker' in name_lower and 'science' in name_lower:
        return 'computer_science'

    # Science buildings
    if any(word in name_lower for word in [
        'science', 'biology', 'chemistry', 'physics', 'fisher'
    ]):
        return 'science_building'

    # Library
    if 'library' in name_lower or 'kennedy' in name_lower:
        return 'library'

    # Business
    if any(word in name_lower for word in ['business', 'orfalea']):
        return 'business'

    # Mathematics
    if any(word in name_lower for word in ['mathematics', 'math']):
        return 'mathematics'

    # Architecture
    if any(word in name_lower for word in [
        'architecture', 'environmental design', 'dexter'
    ]):
        return 'architecture'

    # Performing Arts / Music / Theatre
    if any(word in name_lower for word in [
        'performing arts', 'music', 'davidson', 'spanos'
    ]):
        return 'performing_arts'
    if 'theatre' in name_lower or 'theater' in name_lower:
        return 'theatre'

    # Residential - Halls
    if any(word in name_lower for word in [
        'hall', 'residence', 'tower', 'cerro vista', 'poly canyon',
        'sierra madre', 'yosemite', 'tenaya', 'santa lucia', 'sequoia',
        'muir', 'fremont', 'trinity'
    ]):
        return 'dormitory'

    # Dining
    if any(word in name_lower for word in [
        'dining', 'vista grande', '19 metro', 'campus market', 'avenue'
    ]):
        return 'dining'
    if any(word in name_lower for word in ['starbucks', 'jamba', 'coffee']):
        return 'cafe'
    if 'restaurant' in name_lower:
        return 'restaurant'

    # Recreation / Physical Education
    if any(word in name_lower for word in [
        'recreation', 'rec center', 'physical education', 'mott', 'athletic'
    ]):
        return 'recreation'

    # Administrative
    if any(word in name_lower for word in [
        'administration', 'admissions', 'student services', 'services',
        'foundation', 'advancement'
    ]):
        return 'administrative'

    # Police
    if 'police' in name_lower or 'public safety' in name_lower:
        return 'police'

    # Agriculture
    if any(word in name_lower for word in [
        'agriculture', 'farm', 'ranch', 'dairy', 'agricultural', 'animal science',
        'crop', 'greenhouse', 'environmental horticultural'
    ]):
        return 'agriculture'

    # Health
    if any(word in name_lower for word in [
        'health', 'medical', 'clinic', 'wellness'
    ]):
        return 'health'

    # Parking
    if 'parking' in name_lower:
        if 'structure' in name_lower:
            return 'parking'
        return 'parking_entrance'

    # Maintenance / Utilities
    if any(word in name_lower for word in [
        'maintenance', 'warehouse', 'facility', 'plant operations'
    ]):
        return 'maintenance'

    # Laboratory
    if 'lab' in name_lower and 'laboratory' in name_lower:
        return 'laboratory'

    # Community / Student Union
    if any(word in name_lower for word in [
        'university union', 'student union', 'epicenter'
    ]):
        return 'community_centre'

    return None


def main():
    # Read buildings file
    with open('buildings.geojson', 'r') as f:
        buildings = json.load(f)

    # Create backup
    with open('buildings.geojson.backup4', 'w') as f:
        json.dump(buildings, f, indent=2)
    print(f"Created backup: buildings.geojson.backup4")

    # Enrich buildings
    enriched_count = 0
    already_has_amenity = 0

    for feature in buildings['features']:
        if 'properties' not in feature:
            continue

        props = feature['properties']

        # Skip if amenity already exists
        if 'amenity' in props and props['amenity']:
            already_has_amenity += 1
            continue

        # Try to infer amenity
        name = props.get('name', '')
        building_type = props.get('building', '')

        amenity = infer_amenity(name, building_type)

        if amenity:
            props['amenity'] = amenity
            enriched_count += 1
            print(f"Enriched: {name} -> {amenity}")

    # Write updated file
    with open('buildings.geojson', 'w') as f:
        json.dump(buildings, f, indent=2)

    print(f"\nTotal buildings: {len(buildings['features'])}")
    print(f"Already had amenity: {already_has_amenity}")
    print(f"Newly enriched: {enriched_count}")
    print(f"Buildings with amenity: {already_has_amenity + enriched_count}")
    print(f"Buildings without amenity: {len(buildings['features']) - already_has_amenity - enriched_count}")


if __name__ == '__main__':
    main()
