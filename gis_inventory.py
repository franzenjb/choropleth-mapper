#!/usr/bin/env python3
"""
ChloraPleth GIS Database Inventory Tool
Scans and analyzes all geospatial assets in the repository
"""

import json
import os
import sqlite3
from pathlib import Path
import pandas as pd
from datetime import datetime
import geopandas as gpd
from shapely.geometry import box
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GISInventory:
    """Comprehensive inventory of geospatial assets"""
    
    def __init__(self, base_path="."):
        self.base_path = Path(base_path)
        self.inventory = []
        
    def scan_directory(self, directory=None):
        """Recursively scan for geospatial files"""
        if directory is None:
            directory = self.base_path
            
        # File extensions to look for - only actual geospatial files
        geo_extensions = ['.shp', '.geojson', '.gpkg', '.kml', '.kmz']
        
        logger.info(f"Scanning directory: {directory}")
        
        for file_path in directory.rglob('*'):
            if file_path.suffix.lower() in geo_extensions:
                # Skip node_modules and other non-data directories
                if 'node_modules' in str(file_path) or '.claude' in str(file_path):
                    continue
                    
                try:
                    info = self.analyze_file(file_path)
                    if info and info['record_count'] > 0:  # Only add files with actual geo data
                        self.inventory.append(info)
                        logger.info(f"Added: {file_path.name}")
                except Exception as e:
                    logger.warning(f"Could not analyze {file_path}: {e}")
            elif file_path.suffix.lower() == '.json' and 'data' in str(file_path):
                # Only check JSON files in data directories
                try:
                    info = self.analyze_file(file_path)
                    if info and info['record_count'] > 0:
                        self.inventory.append(info)
                        logger.info(f"Added: {file_path.name}")
                except Exception as e:
                    logger.warning(f"Could not analyze {file_path}: {e}")
                    
    def analyze_file(self, file_path):
        """Analyze a single geospatial file"""
        try:
            # Basic file info
            stat = file_path.stat()
            
            info = {
                'filename': file_path.name,
                'path': str(file_path),
                'extension': file_path.suffix.lower(),
                'size_mb': round(stat.st_size / (1024*1024), 2),
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'type': self.detect_geo_type(file_path),
                'record_count': 0,
                'crs': None,
                'bounds': None,
                'geography_level': None,
                'coverage_area': None
            }
            
            # Try to read with geopandas for detailed analysis
            if file_path.suffix.lower() in ['.geojson', '.json']:
                gdf = self.read_geojson_sample(file_path)
            elif file_path.suffix.lower() == '.shp':
                gdf = gpd.read_file(file_path)
            else:
                return info
                
            if gdf is not None and len(gdf) > 0:
                info['record_count'] = len(gdf)
                info['crs'] = str(gdf.crs) if gdf.crs else 'Unknown'
                
                # Get bounds
                bounds = gdf.total_bounds
                info['bounds'] = {
                    'minx': round(bounds[0], 4),
                    'miny': round(bounds[1], 4), 
                    'maxx': round(bounds[2], 4),
                    'maxy': round(bounds[3], 4)
                }
                
                # Detect geography level and coverage
                info['geography_level'] = self.detect_geography_level(file_path.name, gdf)
                info['coverage_area'] = self.detect_coverage_area(gdf, info['geography_level'])
                
                # Get column names for join potential
                info['columns'] = list(gdf.columns)
                info['join_fields'] = self.identify_join_fields(gdf.columns) or []
                
            return info
            
        except Exception as e:
            logger.error(f"Error analyzing {file_path}: {e}")
            return None
    
    def read_geojson_sample(self, file_path):
        """Read GeoJSON with memory efficiency for large files"""
        try:
            # For very large files, read a sample first
            if file_path.stat().st_size > 50 * 1024 * 1024:  # 50MB
                with open(file_path, 'r') as f:
                    # Read first few lines to check structure
                    sample = f.read(10000)
                    if '"features"' in sample:
                        # This is a feature collection, try to read just first 100 features
                        return gpd.read_file(file_path, rows=100)
            
            return gpd.read_file(file_path)
        except Exception as e:
            logger.warning(f"Could not read {file_path}: {e}")
            return None
    
    def detect_geo_type(self, file_path):
        """Detect the type of geospatial data"""
        name = file_path.name.lower()
        
        if 'county' in name or 'counties' in name:
            return 'Counties'
        elif 'zip' in name or 'zcta' in name:
            return 'ZIP Codes'
        elif 'state' in name:
            return 'States'
        elif 'tract' in name:
            return 'Census Tracts'
        elif 'block' in name:
            return 'Census Blocks'
        elif 'place' in name:
            return 'Places'
        elif 'subcounty' in name:
            return 'Subcounty'
        else:
            return 'Unknown'
    
    def detect_geography_level(self, filename, gdf):
        """Detect the geographic level from filename and data"""
        name = filename.lower()
        
        # Check filename patterns
        if 'county' in name or 'counties' in name:
            return 'County'
        elif 'zip' in name or 'zcta' in name:
            return 'ZIP Code'
        elif 'state' in name:
            return 'State'
        elif 'tract' in name:
            return 'Census Tract'
        elif 'block' in name:
            return 'Census Block'
        elif 'place' in name:
            return 'Place'
        elif 'subcounty' in name:
            return 'Subcounty'
        
        # Check column names for clues
        columns = [col.lower() for col in gdf.columns]
        if any(col in columns for col in ['geoid', 'fips', 'countyfp']):
            if len(str(gdf.iloc[0].get('GEOID', ''))) == 5:
                return 'County'
            elif len(str(gdf.iloc[0].get('GEOID', ''))) == 5:
                return 'ZIP Code'
                
        return 'Unknown'
    
    def detect_coverage_area(self, gdf, geo_level):
        """Detect what geographic area is covered"""
        try:
            if 'STATEFP' in gdf.columns:
                states = gdf['STATEFP'].unique()
                state_names = self.fips_to_state_names(states)
                if len(state_names) == 1:
                    return f"{state_names[0]} only"
                elif len(state_names) <= 5:
                    return f"{len(state_names)} states: {', '.join(state_names)}"
                else:
                    return f"Multi-state ({len(state_names)} states)"
            
            # Check bounds to estimate coverage
            bounds = gdf.total_bounds
            if bounds[0] > -130 and bounds[2] < -60:  # Rough US bounds
                if bounds[2] - bounds[0] > 50:  # Wide coverage
                    return "National/Multi-regional"
                else:
                    return "Regional"
            
            return "Unknown coverage"
        except:
            return "Unknown coverage"
    
    def fips_to_state_names(self, fips_codes):
        """Convert FIPS codes to state names"""
        fips_map = {
            '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
            '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
            '11': 'DC', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
            '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
            '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
            '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
            '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
            '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
            '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
            '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
            '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
            '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
            '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
        }
        
        return [fips_map.get(str(code).zfill(2), f"FIPS {code}") for code in fips_codes]
    
    def identify_join_fields(self, columns):
        """Identify columns that could be used for joins"""
        join_fields = []
        col_lower = [col.lower() for col in columns]
        
        # Common join field patterns
        join_patterns = {
            'fips': ['fips', 'geoid', 'countyfp', 'statefp'],
            'zip': ['zip', 'zipcode', 'zcta', 'postal'],
            'name': ['name', 'county', 'state', 'place']
        }
        
        for pattern_type, patterns in join_patterns.items():
            for pattern in patterns:
                matching_cols = [col for col in columns if pattern in col.lower()]
                if matching_cols:
                    join_fields.extend([(col, pattern_type) for col in matching_cols])
        
        return join_fields
    
    def generate_report(self):
        """Generate comprehensive inventory report"""
        if not self.inventory:
            return "No geospatial files found."
        
        df = pd.DataFrame(self.inventory)
        
        report = []
        report.append("="*80)
        report.append("CHLORAPLETH GIS DATABASE INVENTORY REPORT")
        report.append("="*80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Files analyzed: {len(self.inventory)}")
        report.append(f"Total size: {df['size_mb'].sum():.1f} MB")
        report.append("")
        
        # Summary by geography level
        report.append("COVERAGE BY GEOGRAPHY LEVEL:")
        report.append("-" * 40)
        for level in df['geography_level'].value_counts().index:
            count = df[df['geography_level'] == level]['record_count'].sum()
            files = len(df[df['geography_level'] == level])
            report.append(f"{level:15}: {files:2} files, {count:,} total records")
        report.append("")
        
        # File details
        report.append("DETAILED FILE INVENTORY:")
        report.append("-" * 80)
        for _, item in df.iterrows():
            report.append(f"File: {item['filename']}")
            report.append(f"  Type: {item['type']} ({item['geography_level']})")
            report.append(f"  Records: {item['record_count']:,}")
            report.append(f"  Size: {item['size_mb']} MB")
            report.append(f"  Coverage: {item['coverage_area']}")
            report.append(f"  CRS: {item['crs']}")
            if item['join_fields'] and isinstance(item['join_fields'], list):
                fields = [f"{field}({type_})" for field, type_ in item['join_fields']]
                report.append(f"  Join fields: {', '.join(fields)}")
            report.append("")
        
        # Coverage summary
        report.append("GEOGRAPHIC COVERAGE SUMMARY:")
        report.append("-" * 40)
        
        # Estimate US coverage
        us_total_counties = 3143
        us_total_zips = 33000  # approximate
        
        county_records = df[df['geography_level'] == 'County']['record_count'].sum()
        zip_records = df[df['geography_level'] == 'ZIP Code']['record_count'].sum()
        
        if county_records > 0:
            county_coverage = min(100, (county_records / us_total_counties) * 100)
            report.append(f"Counties: {county_records:,} records (~{county_coverage:.1f}% of US)")
        
        if zip_records > 0:
            zip_coverage = min(100, (zip_records / us_total_zips) * 100)
            report.append(f"ZIP Codes: {zip_records:,} records (~{zip_coverage:.1f}% of US)")
        
        state_records = df[df['geography_level'] == 'State']['record_count'].sum()
        if state_records > 0:
            report.append(f"States: {state_records} records")
        
        return "\n".join(report)
    
    def save_to_csv(self, filename="gis_inventory.csv"):
        """Save inventory to CSV"""
        if self.inventory:
            df = pd.DataFrame(self.inventory)
            df.to_csv(filename, index=False)
            logger.info(f"Inventory saved to {filename}")
    
    def create_metadata_db(self, db_name="gis_metadata.db"):
        """Create SQLite database with metadata"""
        conn = sqlite3.connect(db_name)
        
        # Create inventory table with simplified data
        df = pd.DataFrame(self.inventory)
        
        # Convert complex fields to strings for SQLite compatibility
        df_simple = df.copy()
        for col in ['bounds', 'join_fields', 'columns']:
            if col in df_simple.columns:
                df_simple[col] = df_simple[col].astype(str)
        
        df_simple.to_sql('gis_inventory', conn, if_exists='replace', index=False)
        
        # Create summary views
        conn.execute("""
        CREATE VIEW coverage_summary AS
        SELECT 
            geography_level,
            COUNT(*) as file_count,
            SUM(record_count) as total_records,
            ROUND(SUM(size_mb), 2) as total_size_mb,
            GROUP_CONCAT(DISTINCT coverage_area) as coverage_areas
        FROM gis_inventory 
        GROUP BY geography_level
        """)
        
        conn.commit()
        conn.close()
        logger.info(f"Metadata database created: {db_name}")

def main():
    """Main function to run inventory"""
    print("ChloraPleth GIS Database Inventory Tool")
    print("="*50)
    
    # Initialize inventory
    inventory = GISInventory()
    
    # Scan for files
    inventory.scan_directory()
    
    # Generate and display report
    report = inventory.generate_report()
    print(report)
    
    # Save outputs
    inventory.save_to_csv()
    inventory.create_metadata_db()
    
    print("\nInventory complete!")
    print("Files generated:")
    print("- gis_inventory.csv (detailed inventory)")
    print("- gis_metadata.db (SQLite database)")

if __name__ == "__main__":
    main()