#!/usr/bin/env python3
"""
Census Coverage Analysis
Estimates file sizes and download requirements for 100% US Census coverage
"""

import pandas as pd
from pathlib import Path

def analyze_census_coverage_requirements():
    """Analyze what's needed for 100% census coverage at all levels"""
    
    print("="*80)
    print("CENSUS COVERAGE ANALYSIS - 100% US COVERAGE REQUIREMENTS")
    print("="*80)
    
    # Current coverage analysis
    print("\n📊 CURRENT COVERAGE STATUS:")
    print("-" * 40)
    
    current_coverage = {
        'Counties': {'records': 3222, 'coverage': '100%', 'size_mb': 2.95},
        'ZIP Codes': {'records': 34925, 'coverage': '100%', 'size_mb': 27.03},
        'States': {'records': 52, 'coverage': '100%', 'size_mb': 0.09},
        'Census Tracts': {'records': 0, 'coverage': '0%', 'size_mb': 0},
        'Census Blocks': {'records': 0, 'coverage': '0%', 'size_mb': 0},
        'Block Groups': {'records': 0, 'coverage': '0%', 'size_mb': 0},
        'Places': {'records': 0, 'coverage': '0%', 'size_mb': 0}
    }
    
    for level, info in current_coverage.items():
        status = "✅" if info['coverage'] == '100%' else "❌"
        print(f"{status} {level:15}: {info['records']:>6,} records ({info['coverage']}) - {info['size_mb']:.2f} MB")
    
    print(f"\nCurrent total size: {sum(info['size_mb'] for info in current_coverage.values()):.1f} MB")
    
    # US Geographic entity counts (2020 Census)
    us_totals = {
        'States': 52,
        'Counties': 3143,
        'ZIP Codes': 33120,  # ZCTA5
        'Census Tracts': 84414,
        'Block Groups': 247097,
        'Census Blocks': 11078297,  # ~11 million blocks
        'Places': 29573,
        'Congressional Districts': 436,
        'School Districts': 13452
    }
    
    # Estimated file sizes based on 2024 TIGER/Line data patterns
    estimated_sizes = {
        'States': 0.1,  # Very small
        'Counties': 3.0,  # Already have
        'ZIP Codes': 30.0,  # Already have
        'Census Tracts': 150.0,  # ~150 MB for all tracts
        'Block Groups': 200.0,  # ~200 MB for all block groups
        'Census Blocks': 2700.0,  # ~2.7 GB (compressed) from Census data
        'Places': 50.0,  # ~50 MB for all places
        'Congressional Districts': 5.0,  # Small file
        'School Districts': 25.0   # ~25 MB
    }
    
    print("\n🎯 REQUIRED FOR 100% COVERAGE:")
    print("-" * 40)
    
    total_needed_mb = 0
    for level, count in us_totals.items():
        size_mb = estimated_sizes.get(level, 0)
        have_it = current_coverage.get(level, {}).get('coverage') == '100%'
        status = "✅ Have" if have_it else "🔄 Need"
        
        if not have_it:
            total_needed_mb += size_mb
            
        print(f"{status} {level:20}: {count:>8,} features - {size_mb:>6.1f} MB")
    
    print(f"\nTotal needed to download: {total_needed_mb:.1f} MB ({total_needed_mb/1024:.2f} GB)")
    total_final_size = sum(estimated_sizes.values())
    print(f"Final complete dataset size: {total_final_size:.1f} MB ({total_final_size/1024:.2f} GB)")
    
    # Download analysis
    print("\n⏱️ DOWNLOAD TIME ESTIMATES:")
    print("-" * 40)
    
    download_speeds = {
        'Slow (10 Mbps)': 10,
        'Average (50 Mbps)': 50, 
        'Fast (100 Mbps)': 100,
        'Very Fast (500 Mbps)': 500
    }
    
    # Convert MB to Megabits for calculation (1 MB = 8 Mb)
    total_needed_mb_bits = total_needed_mb * 8
    
    for speed_name, speed_mbps in download_speeds.items():
        time_seconds = total_needed_mb_bits / speed_mbps
        time_minutes = time_seconds / 60
        time_hours = time_minutes / 60
        
        if time_hours < 1:
            time_str = f"{time_minutes:.1f} minutes"
        else:
            time_str = f"{time_hours:.1f} hours"
            
        print(f"{speed_name:15}: {time_str}")
    
    # Complexity analysis
    print("\n🔧 IMPLEMENTATION COMPLEXITY:")
    print("-" * 40)
    
    complexity_analysis = {
        'Census Tracts': {
            'difficulty': 'Easy',
            'files': '50 state files',
            'notes': 'Standard geographic boundaries, good for demographic analysis'
        },
        'Block Groups': {
            'difficulty': 'Easy', 
            'files': '50 state files',
            'notes': 'Smaller than tracts, good for detailed demographic mapping'
        },
        'Places': {
            'difficulty': 'Medium',
            'files': '50 state files',
            'notes': 'Cities/towns, overlapping boundaries with counties'
        },
        'Census Blocks': {
            'difficulty': 'High',
            'files': '3000+ county files',
            'notes': 'Massive dataset, 11M+ blocks, requires significant processing'
        }
    }
    
    for level, info in complexity_analysis.items():
        if level not in ['States', 'Counties', 'ZIP Codes']:  # Skip what we have
            difficulty_icon = {'Easy': '🟢', 'Medium': '🟡', 'High': '🔴'}[info['difficulty']]
            print(f"{difficulty_icon} {level:15}: {info['difficulty']:6} - {info['files']} - {info['notes']}")
    
    # Priority recommendations
    print("\n🎯 RECOMMENDED PRIORITY ORDER:")
    print("-" * 40)
    
    priorities = [
        ('Census Tracts', 'High business value, manageable size, demographic analysis'),
        ('Block Groups', 'Detailed analysis, still manageable size'),
        ('Places', 'City/town mapping, useful for Red Cross chapters'),
        ('Census Blocks', 'Ultimate detail but massive size - consider subset approach')
    ]
    
    for i, (level, reason) in enumerate(priorities, 1):
        print(f"{i}. {level:15}: {reason}")
    
    # Storage requirements
    print("\n💾 STORAGE REQUIREMENTS:")
    print("-" * 40)
    
    storage_scenarios = {
        'Minimal (Tracts + Block Groups)': 350,  # MB
        'Standard (+ Places)': 400,  # MB  
        'Complete (All including Blocks)': 3200,  # MB
        'Complete + Backups': 6400  # MB
    }
    
    for scenario, size_mb in storage_scenarios.items():
        size_gb = size_mb / 1024
        print(f"{scenario:25}: {size_mb:>5.0f} MB ({size_gb:.1f} GB)")
    
    # Cost/benefit analysis
    print("\n💰 COST/BENEFIT ANALYSIS:")
    print("-" * 40)
    
    benefits = {
        'Census Tracts': [
            '✅ Standard unit for demographic analysis',
            '✅ ACS data readily available at tract level', 
            '✅ Used by most government agencies',
            '✅ Good balance of detail vs. manageability'
        ],
        'Block Groups': [
            '✅ More detailed than tracts',
            '✅ Still has demographic data available',
            '✅ Good for neighborhood-level analysis'
        ],
        'Census Blocks': [
            '✅ Ultimate geographic precision',
            '✅ Building-level accuracy',
            '❌ Limited demographic data',
            '❌ Massive file sizes',
            '❌ Processing complexity'
        ]
    }
    
    for level, benefit_list in benefits.items():
        if level != 'Census Blocks':  # Skip the complex one for now
            print(f"\n{level}:")
            for benefit in benefit_list:
                print(f"  {benefit}")
    
    print("\n🚀 QUICK START RECOMMENDATION:")
    print("-" * 40)
    print("1. Start with Census Tracts (150 MB) - High value, low complexity")
    print("2. Add Block Groups (200 MB) if more detail needed") 
    print("3. Add Places (50 MB) for city/town analysis")
    print("4. Consider Census Blocks only for specific high-priority areas")
    print(f"\nTotal for recommended start: ~400 MB (0.4 GB)")
    print("Download time: 5-30 minutes depending on connection speed")

if __name__ == "__main__":
    analyze_census_coverage_requirements()