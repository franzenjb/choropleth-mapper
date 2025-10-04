#!/usr/bin/env python3
"""
ChloraPleth CSV-to-Shapefile Join Tool
Joins CSV data to geospatial layers using various geographic identifiers
"""

import pandas as pd
import geopandas as gpd
import sqlite3
from pathlib import Path
import logging
from typing import Dict, List, Tuple, Optional
import re
from fuzzywuzzy import fuzz, process
import json

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CSVShapefileJoiner:
    """Main class for joining CSV data to geospatial layers"""
    
    def __init__(self, data_dir="data", metadata_db="gis_metadata.db"):
        self.data_dir = Path(data_dir)
        self.metadata_db = metadata_db
        self.available_layers = self.load_available_layers()
        
    def load_available_layers(self) -> Dict:
        """Load available geospatial layers from metadata database"""
        try:
            conn = sqlite3.connect(self.metadata_db)
            query = "SELECT * FROM gis_inventory"
            df = pd.read_sql_query(query, conn)
            conn.close()
            
            layers = {}
            for _, row in df.iterrows():
                layers[row['filename']] = {
                    'path': row['path'],
                    'type': row['type'],
                    'geography_level': row['geography_level'],
                    'record_count': row['record_count'],
                    'crs': row['crs'],
                    'join_fields': eval(row['join_fields']) if row['join_fields'] != 'nan' else [],
                    'coverage_area': row['coverage_area']
                }
            
            logger.info(f"Loaded {len(layers)} available layers")
            return layers
            
        except Exception as e:
            logger.warning(f"Could not load metadata: {e}")
            return self.scan_data_directory()
    
    def scan_data_directory(self) -> Dict:
        """Fallback: scan data directory for available layers"""
        layers = {}
        for file_path in self.data_dir.glob('*.json'):
            try:
                gdf = gpd.read_file(file_path, rows=1)  # Just read first row for metadata
                layers[file_path.name] = {
                    'path': str(file_path),
                    'type': self.detect_layer_type(file_path.name),
                    'geography_level': self.detect_geography_level(file_path.name),
                    'columns': list(gdf.columns),
                    'crs': str(gdf.crs)
                }
            except Exception as e:
                logger.warning(f"Could not read {file_path}: {e}")
        
        return layers
    
    def detect_layer_type(self, filename):
        """Detect layer type from filename"""
        name = filename.lower()
        if 'county' in name or 'counties' in name:
            return 'Counties'
        elif 'zip' in name or 'zcta' in name:
            return 'ZIP Codes'
        elif 'state' in name:
            return 'States'
        elif 'tract' in name:
            return 'Census Tracts'
        else:
            return 'Unknown'
    
    def detect_geography_level(self, filename):
        """Detect geography level from filename"""
        name = filename.lower()
        if 'county' in name or 'counties' in name:
            return 'County'
        elif 'zip' in name or 'zcta' in name:
            return 'ZIP Code'
        elif 'state' in name:
            return 'State'
        elif 'tract' in name:
            return 'Census Tract'
        else:
            return 'Unknown'
    
    def list_available_layers(self) -> pd.DataFrame:
        """Return a DataFrame of available layers"""
        data = []
        for filename, info in self.available_layers.items():
            data.append({
                'Layer': filename,
                'Type': info.get('type', 'Unknown'),
                'Geography': info.get('geography_level', 'Unknown'),
                'Records': info.get('record_count', 'Unknown'),
                'Coverage': info.get('coverage_area', 'Unknown')
            })
        
        return pd.DataFrame(data)
    
    def analyze_csv(self, csv_path: str) -> Dict:
        """Analyze CSV file to identify potential join fields"""
        try:
            df = pd.read_csv(csv_path, nrows=10)  # Read sample
            
            analysis = {
                'filename': Path(csv_path).name,
                'total_rows': len(pd.read_csv(csv_path)),  # Get actual count
                'columns': list(df.columns),
                'potential_joins': self.identify_join_columns(df),
                'sample_data': df.head(3).to_dict('records')
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing CSV {csv_path}: {e}")
            return None
    
    def identify_join_columns(self, df: pd.DataFrame) -> Dict:
        """Identify columns that could be used for joining"""
        join_fields = {
            'fips': [],
            'zip': [],
            'name': [],
            'state': []
        }
        
        for col in df.columns:
            col_lower = col.lower()
            sample_vals = df[col].dropna().astype(str).head(5).tolist()
            
            # Check for FIPS patterns
            if any(keyword in col_lower for keyword in ['fips', 'geoid', 'county']):
                if any(len(str(val)) == 5 and str(val).isdigit() for val in sample_vals):
                    join_fields['fips'].append({
                        'column': col,
                        'type': 'County FIPS',
                        'sample': sample_vals[:3]
                    })
                elif any(len(str(val)) == 2 and str(val).isdigit() for val in sample_vals):
                    join_fields['fips'].append({
                        'column': col,
                        'type': 'State FIPS',
                        'sample': sample_vals[:3]
                    })
            
            # Check for ZIP patterns
            if any(keyword in col_lower for keyword in ['zip', 'postal', 'zcta']):
                if any(len(str(val)) == 5 and str(val).isdigit() for val in sample_vals):
                    join_fields['zip'].append({
                        'column': col,
                        'type': 'ZIP Code',
                        'sample': sample_vals[:3]
                    })
            
            # Check for name patterns
            if any(keyword in col_lower for keyword in ['name', 'county', 'place', 'city']):
                if any(isinstance(val, str) and len(val) > 2 for val in sample_vals):
                    join_fields['name'].append({
                        'column': col,
                        'type': 'Location Name',
                        'sample': sample_vals[:3]
                    })
            
            # Check for state patterns
            if any(keyword in col_lower for keyword in ['state', 'st']):
                join_fields['state'].append({
                    'column': col,
                    'type': 'State',
                    'sample': sample_vals[:3]
                })
        
        return join_fields
    
    def suggest_best_join(self, csv_analysis: Dict) -> List[Dict]:
        """Suggest the best join options based on CSV analysis"""
        suggestions = []
        
        for layer_name, layer_info in self.available_layers.items():
            geography = layer_info.get('geography_level', 'Unknown')
            
            # Score potential matches
            score = 0
            join_options = []
            
            # Check for FIPS matches
            if csv_analysis['potential_joins']['fips']:
                for csv_field in csv_analysis['potential_joins']['fips']:
                    if geography == 'County' and csv_field['type'] == 'County FIPS':
                        score += 10
                        join_options.append({
                            'csv_field': csv_field['column'],
                            'geo_field': 'GEOID',
                            'type': 'FIPS',
                            'confidence': 'High'
                        })
                    elif geography == 'State' and csv_field['type'] == 'State FIPS':
                        score += 10
                        join_options.append({
                            'csv_field': csv_field['column'],
                            'geo_field': 'STATEFP',
                            'type': 'FIPS',
                            'confidence': 'High'
                        })
            
            # Check for ZIP matches
            if csv_analysis['potential_joins']['zip'] and geography == 'ZIP Code':
                for csv_field in csv_analysis['potential_joins']['zip']:
                    score += 9
                    join_options.append({
                        'csv_field': csv_field['column'],
                        'geo_field': 'GEOID10',
                        'type': 'ZIP',
                        'confidence': 'High'
                    })
            
            # Check for name matches (lower confidence)
            if csv_analysis['potential_joins']['name']:
                for csv_field in csv_analysis['potential_joins']['name']:
                    if geography == 'County':
                        score += 5
                        join_options.append({
                            'csv_field': csv_field['column'],
                            'geo_field': 'NAME',
                            'type': 'Name',
                            'confidence': 'Medium'
                        })
            
            if score > 0:
                suggestions.append({
                    'layer': layer_name,
                    'geography': geography,
                    'coverage': layer_info.get('coverage_area', 'Unknown'),
                    'score': score,
                    'join_options': join_options
                })
        
        # Sort by score (best matches first)
        suggestions.sort(key=lambda x: x['score'], reverse=True)
        return suggestions[:5]  # Return top 5 suggestions
    
    def perform_join(self, csv_path: str, layer_name: str, csv_field: str, 
                    geo_field: str, fuzzy_match: bool = False) -> gpd.GeoDataFrame:
        """Perform the actual join between CSV and geospatial layer"""
        try:
            # Load CSV data
            csv_df = pd.read_csv(csv_path)
            logger.info(f"Loaded CSV with {len(csv_df)} records")
            
            # Load geospatial layer
            layer_info = self.available_layers[layer_name]
            geo_df = gpd.read_file(layer_info['path'])
            logger.info(f"Loaded geospatial layer with {len(geo_df)} features")
            
            # Prepare join fields
            csv_df[csv_field] = csv_df[csv_field].astype(str).str.strip()
            geo_df[geo_field] = geo_df[geo_field].astype(str).str.strip()
            
            if fuzzy_match and geo_field in ['NAME', 'COUNTY']:
                # Perform fuzzy matching for name fields
                joined_df = self.fuzzy_join(csv_df, geo_df, csv_field, geo_field)
            else:
                # Perform exact join
                joined_df = geo_df.merge(csv_df, left_on=geo_field, right_on=csv_field, how='left')
            
            # Add join statistics
            total_geo = len(geo_df)
            total_csv = len(csv_df)
            joined_count = len(joined_df.dropna(subset=[csv_field]))
            
            join_stats = {
                'total_geographic_features': total_geo,
                'total_csv_records': total_csv,
                'successful_joins': joined_count,
                'join_rate': f"{(joined_count/total_geo)*100:.1f}%",
                'unmatched_geographic': total_geo - joined_count,
                'unmatched_csv': total_csv - joined_count
            }
            
            # Add statistics as attributes
            joined_df.attrs['join_stats'] = join_stats
            
            logger.info(f"Join completed: {joined_count}/{total_geo} features matched ({join_stats['join_rate']})")
            
            return joined_df
            
        except Exception as e:
            logger.error(f"Error performing join: {e}")
            raise
    
    def fuzzy_join(self, csv_df: pd.DataFrame, geo_df: gpd.GeoDataFrame, 
                   csv_field: str, geo_field: str, threshold: int = 80) -> gpd.GeoDataFrame:
        """Perform fuzzy string matching for name-based joins"""
        logger.info("Performing fuzzy name matching...")
        
        # Create lookup dictionary for geographic names
        geo_names = geo_df[geo_field].tolist()
        csv_names = csv_df[csv_field].unique().tolist()
        
        # Find best matches
        matches = {}
        for csv_name in csv_names:
            if pd.isna(csv_name):
                continue
                
            best_match = process.extractOne(csv_name, geo_names)
            if best_match and best_match[1] >= threshold:
                matches[csv_name] = best_match[0]
                
        logger.info(f"Found {len(matches)} fuzzy matches above {threshold}% threshold")
        
        # Apply matches to CSV
        csv_df_matched = csv_df.copy()
        csv_df_matched[f'{csv_field}_matched'] = csv_df_matched[csv_field].map(matches)
        
        # Join on matched names
        joined_df = geo_df.merge(
            csv_df_matched, 
            left_on=geo_field, 
            right_on=f'{csv_field}_matched', 
            how='left'
        )
        
        return joined_df
    
    def export_results(self, joined_gdf: gpd.GeoDataFrame, output_path: str, 
                      format_type: str = 'geojson') -> str:
        """Export joined results to various formats"""
        try:
            output_path = Path(output_path)
            
            if format_type.lower() == 'geojson':
                output_file = output_path.with_suffix('.geojson')
                joined_gdf.to_file(output_file, driver='GeoJSON')
                
            elif format_type.lower() == 'shapefile':
                output_file = output_path.with_suffix('.shp')
                # Truncate column names for shapefile compatibility
                gdf_copy = joined_gdf.copy()
                gdf_copy.columns = [col[:10] if len(col) > 10 else col for col in gdf_copy.columns]
                gdf_copy.to_file(output_file, driver='ESRI Shapefile')
                
            elif format_type.lower() == 'csv':
                output_file = output_path.with_suffix('.csv')
                # Export without geometry for CSV
                df_no_geom = joined_gdf.drop(columns=['geometry'])
                df_no_geom.to_csv(output_file, index=False)
                
            elif format_type.lower() == 'gpkg':
                output_file = output_path.with_suffix('.gpkg')
                joined_gdf.to_file(output_file, driver='GPKG')
                
            else:
                raise ValueError(f"Unsupported format: {format_type}")
            
            # Save join statistics
            if hasattr(joined_gdf, 'attrs') and 'join_stats' in joined_gdf.attrs:
                stats_file = output_path.with_suffix('.json')
                with open(stats_file, 'w') as f:
                    json.dump(joined_gdf.attrs['join_stats'], f, indent=2)
                logger.info(f"Join statistics saved to {stats_file}")
            
            logger.info(f"Results exported to {output_file}")
            return str(output_file)
            
        except Exception as e:
            logger.error(f"Error exporting results: {e}")
            raise

def main():
    """Command line interface for the join tool"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Join CSV data to geospatial layers')
    parser.add_argument('--list-layers', action='store_true', 
                       help='List available geospatial layers')
    parser.add_argument('--analyze-csv', type=str, 
                       help='Analyze CSV file for join potential')
    parser.add_argument('--suggest-joins', type=str, 
                       help='Suggest best join options for CSV file')
    parser.add_argument('--join', nargs=5, metavar=('CSV', 'LAYER', 'CSV_FIELD', 'GEO_FIELD', 'OUTPUT'),
                       help='Perform join: CSV_FILE LAYER_NAME CSV_FIELD GEO_FIELD OUTPUT_PATH')
    parser.add_argument('--fuzzy', action='store_true', 
                       help='Use fuzzy matching for name fields')
    parser.add_argument('--format', choices=['geojson', 'shapefile', 'csv', 'gpkg'], 
                       default='geojson', help='Output format')
    
    args = parser.parse_args()
    
    # Initialize joiner
    joiner = CSVShapefileJoiner()
    
    if args.list_layers:
        layers_df = joiner.list_available_layers()
        print("\nAvailable Geospatial Layers:")
        print("=" * 80)
        print(layers_df.to_string(index=False))
        
    elif args.analyze_csv:
        analysis = joiner.analyze_csv(args.analyze_csv)
        if analysis:
            print(f"\nCSV Analysis: {analysis['filename']}")
            print("=" * 50)
            print(f"Total rows: {analysis['total_rows']:,}")
            print(f"Columns: {len(analysis['columns'])}")
            print("\nPotential Join Fields:")
            for join_type, fields in analysis['potential_joins'].items():
                if fields:
                    print(f"\n{join_type.upper()}:")
                    for field in fields:
                        print(f"  - {field['column']} ({field['type']}): {field['sample']}")
                        
    elif args.suggest_joins:
        analysis = joiner.analyze_csv(args.suggest_joins)
        if analysis:
            suggestions = joiner.suggest_best_join(analysis)
            print(f"\nJoin Suggestions for {analysis['filename']}:")
            print("=" * 60)
            for i, suggestion in enumerate(suggestions, 1):
                print(f"\n{i}. {suggestion['layer']} ({suggestion['geography']})")
                print(f"   Coverage: {suggestion['coverage']}")
                print(f"   Score: {suggestion['score']}")
                for option in suggestion['join_options']:
                    print(f"   Join: {option['csv_field']} → {option['geo_field']} ({option['confidence']} confidence)")
                    
    elif args.join:
        csv_file, layer_name, csv_field, geo_field, output_path = args.join
        
        try:
            joined_gdf = joiner.perform_join(csv_file, layer_name, csv_field, geo_field, args.fuzzy)
            output_file = joiner.export_results(joined_gdf, output_path, args.format)
            
            print(f"\nJoin completed successfully!")
            print(f"Output file: {output_file}")
            
            if hasattr(joined_gdf, 'attrs') and 'join_stats' in joined_gdf.attrs:
                stats = joined_gdf.attrs['join_stats']
                print(f"\nJoin Statistics:")
                print(f"  Geographic features: {stats['total_geographic_features']:,}")
                print(f"  CSV records: {stats['total_csv_records']:,}")
                print(f"  Successful joins: {stats['successful_joins']:,}")
                print(f"  Join rate: {stats['join_rate']}")
                
        except Exception as e:
            print(f"Error: {e}")
    
    else:
        parser.print_help()

if __name__ == "__main__":
    main()