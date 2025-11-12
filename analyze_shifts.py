#!/usr/bin/env python3
"""
Analyze shift counts from donor data JSON file
Counts real shifts (days with 2+ animals checked at same location)
"""

import json
import sys
from collections import defaultdict
from datetime import datetime

def analyze_shifts(json_file_path):
    """Analyze shifts from donor data JSON"""
    
    # Load data
    with open(json_file_path, 'r', encoding='utf-8') as f:
        donors = json.load(f)
    
    print(f"Total donors in file: {len(donors)}")
    print("\n" + "="*80)
    
    # Filter to July-October 2025
    target_months = ['2025-07', '2025-08', '2025-09', '2025-10']
    filtered_donors = [d for d in donors if d.get('date', '')[:7] in target_months]
    
    print(f"Donors in July-October 2025: {len(filtered_donors)}")
    print("="*80 + "\n")
    
    # Count animals per day+location (like the new algorithm)
    day_location_counts = defaultdict(int)
    day_location_animals = defaultdict(list)  # Track which animals
    
    for donor in filtered_donors:
        date = donor.get('date', '')
        location = donor.get('location', '')
        animal_name = donor.get('animalName', 'Unknown')
        
        if not date or not location:
            continue
            
        key = f"{date}_{location}"
        day_location_counts[key] += 1
        day_location_animals[key].append(animal_name)
    
    # Identify real shifts (2+ animals)
    real_shifts = {k: v for k, v in day_location_counts.items() if v >= 2}
    single_donations = {k: v for k, v in day_location_counts.items() if v == 1}
    
    print(f"📊 SHIFT ANALYSIS:")
    print(f"  Total day+location combinations: {len(day_location_counts)}")
    print(f"  Real shifts (2+ animals): {len(real_shifts)}")
    print(f"  Single donations (excluded): {len(single_donations)}")
    print("\n" + "="*80 + "\n")
    
    # Group by month
    monthly_stats = defaultdict(lambda: {
        'shifts': set(),
        'donations': 0,
        'day_location_combos': set()
    })
    
    for donor in filtered_donors:
        date = donor.get('date', '')
        location = donor.get('location', '')
        
        if not date or not location:
            continue
        
        month = date[:7]  # YYYY-MM
        key = f"{date}_{location}"
        
        monthly_stats[month]['day_location_combos'].add(key)
        monthly_stats[month]['donations'] += 1
        
        # Only count as shift if 2+ animals on that day+location
        if key in real_shifts:
            monthly_stats[month]['shifts'].add(key)
    
    # Display monthly breakdown
    for month in sorted(target_months):
        if month in monthly_stats:
            stats = monthly_stats[month]
            shifts_count = len(stats['shifts'])
            donations_count = stats['donations']
            combos_count = len(stats['day_location_combos'])
            
            print(f"📅 {month}:")
            print(f"   Shifts (2+ animals/day): {shifts_count}")
            print(f"   Total donations: {donations_count}")
            print(f"   Day+Location combos: {combos_count}")
            print(f"   Avg animals per shift: {donations_count/shifts_count if shifts_count > 0 else 0:.1f}")
            print()
    
    print("="*80 + "\n")
    
    # Show sample single donations that were excluded
    if single_donations:
        print("🔍 SAMPLE SINGLE DONATIONS (NOT counted as shifts):")
        for key, count in list(single_donations.items())[:10]:
            date, location = key.rsplit('_', 1)
            animals = day_location_animals[key]
            print(f"   {date} @ {location}: {animals[0]}")
        if len(single_donations) > 10:
            print(f"   ... and {len(single_donations) - 10} more single donations")
        print()
    
    print("="*80 + "\n")
    
    # Show sample real shifts
    if real_shifts:
        print("✅ SAMPLE REAL SHIFTS (2+ animals, COUNTED):")
        for key, count in list(real_shifts.items())[:15]:
            date, location = key.rsplit('_', 1)
            animals = day_location_animals[key]
            print(f"   {date} @ {location}: {count} animals - {', '.join(animals[:3])}{'...' if len(animals) > 3 else ''}")
        if len(real_shifts) > 15:
            print(f"   ... and {len(real_shifts) - 15} more shifts")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python analyze_shifts.py <path_to_donor_json>")
        sys.exit(1)
    
    analyze_shifts(sys.argv[1])
