#!/usr/bin/env python3
"""
ChloraPleth GIS Database & Join Tool - Streamlit Interface
Interactive web interface for CSV-to-shapefile joins
"""

import streamlit as st
import pandas as pd
import geopandas as gpd
import folium
from streamlit_folium import st_folium
import tempfile
import io
from pathlib import Path
import json
import base64

from csv_shapefile_joiner import CSVShapefileJoiner

# Page configuration
st.set_page_config(
    page_title="ChloraPleth GIS Join Tool",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'joiner' not in st.session_state:
    st.session_state.joiner = CSVShapefileJoiner()
if 'csv_analysis' not in st.session_state:
    st.session_state.csv_analysis = None
if 'joined_data' not in st.session_state:
    st.session_state.joined_data = None

def main():
    st.title("🗺️ ChloraPleth GIS Database & Join Tool")
    st.markdown("Join CSV data to geospatial layers with automated field detection and fuzzy matching")
    
    # Sidebar for navigation
    st.sidebar.title("Navigation")
    page = st.sidebar.radio("Choose a function:", [
        "📊 Data Inventory",
        "📁 CSV Upload & Analysis", 
        "🔗 Perform Join",
        "📈 View Results",
        "💾 Export Data"
    ])
    
    if page == "📊 Data Inventory":
        show_data_inventory()
    elif page == "📁 CSV Upload & Analysis":
        show_csv_upload()
    elif page == "🔗 Perform Join":
        show_join_interface()
    elif page == "📈 View Results":
        show_results()
    elif page == "💾 Export Data":
        show_export()

def show_data_inventory():
    st.header("📊 Available Geospatial Layers")
    
    try:
        layers_df = st.session_state.joiner.list_available_layers()
        
        st.subheader("Layer Summary")
        
        # Summary metrics
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Layers", len(layers_df))
        with col2:
            st.metric("Counties", layers_df[layers_df['Geography'] == 'County']['Records'].sum())
        with col3:
            st.metric("ZIP Codes", layers_df[layers_df['Geography'] == 'ZIP Code']['Records'].sum())
        with col4:
            st.metric("States", layers_df[layers_df['Geography'] == 'State']['Records'].sum())
        
        # Detailed table
        st.subheader("Layer Details")
        st.dataframe(layers_df, use_container_width=True)
        
        # Coverage visualization
        st.subheader("Geographic Coverage")
        geography_counts = layers_df['Geography'].value_counts()
        st.bar_chart(geography_counts)
        
    except Exception as e:
        st.error(f"Error loading inventory: {e}")

def show_csv_upload():
    st.header("📁 CSV Upload & Analysis")
    
    uploaded_file = st.file_uploader(
        "Choose a CSV file", 
        type=['csv'],
        help="Upload a CSV file containing location data to analyze join potential"
    )
    
    if uploaded_file is not None:
        try:
            # Save uploaded file temporarily
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as tmp_file:
                tmp_file.write(uploaded_file.getvalue())
                tmp_path = tmp_file.name
            
            # Analyze the CSV
            with st.spinner("Analyzing CSV file..."):
                analysis = st.session_state.joiner.analyze_csv(tmp_path)
                st.session_state.csv_analysis = analysis
            
            if analysis:
                st.success(f"✅ Analyzed {analysis['filename']}")
                
                # Basic info
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Total Rows", f"{analysis['total_rows']:,}")
                with col2:
                    st.metric("Columns", len(analysis['columns']))
                with col3:
                    potential_joins = sum(len(fields) for fields in analysis['potential_joins'].values())
                    st.metric("Potential Join Fields", potential_joins)
                
                # Column preview
                st.subheader("Column Preview")
                st.write("**All Columns:**", ", ".join(analysis['columns']))
                
                # Sample data
                st.subheader("Sample Data")
                sample_df = pd.DataFrame(analysis['sample_data'])
                st.dataframe(sample_df, use_container_width=True)
                
                # Join field analysis
                st.subheader("Potential Join Fields")
                
                for join_type, fields in analysis['potential_joins'].items():
                    if fields:
                        st.write(f"**{join_type.upper()} Fields:**")
                        for field in fields:
                            st.write(f"- `{field['column']}` ({field['type']}): {field['sample']}")
                
                # Join suggestions
                st.subheader("🎯 Recommended Joins")
                suggestions = st.session_state.joiner.suggest_best_join(analysis)
                
                if suggestions:
                    for i, suggestion in enumerate(suggestions[:3], 1):
                        with st.expander(f"Option {i}: {suggestion['layer']} (Score: {suggestion['score']})"):
                            st.write(f"**Geography Level:** {suggestion['geography']}")
                            st.write(f"**Coverage:** {suggestion['coverage']}")
                            st.write("**Join Options:**")
                            for option in suggestion['join_options']:
                                confidence_color = {"High": "🟢", "Medium": "🟡", "Low": "🔴"}
                                st.write(f"{confidence_color.get(option['confidence'], '⚪')} "
                                       f"`{option['csv_field']}` → `{option['geo_field']}` "
                                       f"({option['confidence']} confidence)")
                else:
                    st.warning("No suitable join options found. Check your data format and column names.")
            
            # Clean up temp file
            Path(tmp_path).unlink()
            
        except Exception as e:
            st.error(f"Error analyzing CSV: {e}")

def show_join_interface():
    st.header("🔗 Perform Join")
    
    if st.session_state.csv_analysis is None:
        st.warning("Please upload and analyze a CSV file first.")
        return
    
    analysis = st.session_state.csv_analysis
    
    st.write(f"**CSV File:** {analysis['filename']} ({analysis['total_rows']:,} rows)")
    
    # Layer selection
    available_layers = list(st.session_state.joiner.available_layers.keys())
    selected_layer = st.selectbox("Select Geospatial Layer:", available_layers)
    
    if selected_layer:
        layer_info = st.session_state.joiner.available_layers[selected_layer]
        st.info(f"**Selected:** {layer_info.get('type', 'Unknown')} layer with "
                f"{layer_info.get('record_count', 'unknown')} features "
                f"({layer_info.get('coverage_area', 'unknown coverage')})")
    
    # Field mapping
    st.subheader("Field Mapping")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.write("**CSV Field (your data):**")
        csv_columns = analysis['columns']
        csv_field = st.selectbox("Choose CSV field for joining:", csv_columns)
        
        if csv_field:
            # Show sample values
            sample_vals = next(
                (field['sample'] for field_list in analysis['potential_joins'].values() 
                 for field in field_list if field['column'] == csv_field), 
                analysis['sample_data'][0].get(csv_field, 'N/A') if analysis['sample_data'] else 'N/A'
            )
            st.write(f"*Sample values:* {sample_vals}")
    
    with col2:
        st.write("**Geographic Field (map data):**")
        
        # Get available fields from selected layer
        if selected_layer:
            layer_info = st.session_state.joiner.available_layers[selected_layer]
            
            # Common geographic fields based on layer type
            if layer_info.get('geography_level') == 'County':
                geo_fields = ['GEOID', 'FIPS', 'NAME', 'COUNTY']
            elif layer_info.get('geography_level') == 'ZIP Code':
                geo_fields = ['GEOID10', 'GEOID', 'ZIP', 'ZCTA5CE10']
            elif layer_info.get('geography_level') == 'State':
                geo_fields = ['STATEFP', 'NAME', 'STUSPS']
            else:
                geo_fields = ['GEOID', 'NAME', 'FIPS']
            
            geo_field = st.selectbox("Choose geographic field for joining:", geo_fields)
    
    # Join options
    st.subheader("Join Options")
    
    fuzzy_match = st.checkbox(
        "Enable fuzzy matching", 
        help="Use fuzzy string matching for name fields (recommended for location names)"
    )
    
    # Perform join
    if st.button("🔗 Perform Join", type="primary"):
        if csv_field and geo_field and selected_layer:
            try:
                # Re-upload CSV for join (user needs to upload again)
                st.warning("Please re-upload your CSV file to perform the join.")
                uploaded_file = st.file_uploader("Re-upload CSV file for joining:", type=['csv'], key="join_upload")
                
                if uploaded_file:
                    with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as tmp_file:
                        tmp_file.write(uploaded_file.getvalue())
                        tmp_path = tmp_file.name
                    
                    with st.spinner("Performing join..."):
                        joined_gdf = st.session_state.joiner.perform_join(
                            tmp_path, selected_layer, csv_field, geo_field, fuzzy_match
                        )
                        st.session_state.joined_data = joined_gdf
                    
                    st.success("✅ Join completed successfully!")
                    
                    # Show join statistics
                    if hasattr(joined_gdf, 'attrs') and 'join_stats' in joined_gdf.attrs:
                        stats = joined_gdf.attrs['join_stats']
                        
                        col1, col2, col3, col4 = st.columns(4)
                        with col1:
                            st.metric("Geographic Features", f"{stats['total_geographic_features']:,}")
                        with col2:
                            st.metric("CSV Records", f"{stats['total_csv_records']:,}")
                        with col3:
                            st.metric("Successful Joins", f"{stats['successful_joins']:,}")
                        with col4:
                            st.metric("Join Rate", stats['join_rate'])
                    
                    # Clean up
                    Path(tmp_path).unlink()
                    
            except Exception as e:
                st.error(f"Error performing join: {e}")
        else:
            st.error("Please select all required fields.")

def show_results():
    st.header("📈 View Results")
    
    if st.session_state.joined_data is None:
        st.warning("No joined data available. Please perform a join first.")
        return
    
    gdf = st.session_state.joined_data
    
    # Data preview
    st.subheader("Data Preview")
    
    # Show basic info
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total Features", len(gdf))
    with col2:
        non_null_data = len(gdf.dropna(subset=[col for col in gdf.columns if col != 'geometry']))
        st.metric("Features with Data", non_null_data)
    with col3:
        st.metric("Columns", len(gdf.columns))
    
    # Show sample data
    st.write("**Sample of joined data:**")
    display_df = gdf.drop(columns=['geometry']).head(10)
    st.dataframe(display_df, use_container_width=True)
    
    # Map visualization
    st.subheader("Map Preview")
    
    try:
        # Create a simple map
        if len(gdf) > 0:
            # Get bounds
            bounds = gdf.total_bounds
            center_lat = (bounds[1] + bounds[3]) / 2
            center_lon = (bounds[0] + bounds[2]) / 2
            
            # Create folium map
            m = folium.Map(
                location=[center_lat, center_lon],
                zoom_start=6,
                tiles='OpenStreetMap'
            )
            
            # Add data to map (sample only for performance)
            sample_gdf = gdf.head(100)  # Limit to first 100 features
            
            # Convert to GeoJSON for folium
            geojson_data = sample_gdf.to_json()
            
            folium.GeoJson(
                geojson_data,
                style_function=lambda x: {
                    'fillColor': 'blue',
                    'color': 'black',
                    'weight': 1,
                    'fillOpacity': 0.3
                }
            ).add_to(m)
            
            # Display map
            st_folium(m, width=700, height=500)
            
            if len(gdf) > 100:
                st.info(f"Showing first 100 features out of {len(gdf)} total for performance.")
    
    except Exception as e:
        st.error(f"Error creating map: {e}")

def show_export():
    st.header("💾 Export Data")
    
    if st.session_state.joined_data is None:
        st.warning("No joined data available. Please perform a join first.")
        return
    
    gdf = st.session_state.joined_data
    
    st.subheader("Export Options")
    
    # Format selection
    export_format = st.selectbox(
        "Choose export format:",
        ["GeoJSON", "Shapefile", "CSV (without geometry)", "GeoPackage (GPKG)"]
    )
    
    # Filename input
    filename = st.text_input("Output filename (without extension):", value="joined_data")
    
    if st.button("💾 Export Data", type="primary"):
        if filename:
            try:
                # Create temporary file for export
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_path = Path(temp_dir) / filename
                    
                    # Export based on format
                    format_map = {
                        "GeoJSON": "geojson",
                        "Shapefile": "shapefile", 
                        "CSV (without geometry)": "csv",
                        "GeoPackage (GPKG)": "gpkg"
                    }
                    
                    output_file = st.session_state.joiner.export_results(
                        gdf, str(temp_path), format_map[export_format]
                    )
                    
                    # Read file for download
                    with open(output_file, 'rb') as f:
                        file_data = f.read()
                    
                    # Determine MIME type
                    mime_types = {
                        "geojson": "application/geo+json",
                        "shapefile": "application/zip",
                        "csv": "text/csv",
                        "gpkg": "application/geopackage+sqlite3"
                    }
                    
                    # Create download button
                    st.download_button(
                        label=f"📥 Download {export_format}",
                        data=file_data,
                        file_name=Path(output_file).name,
                        mime=mime_types.get(format_map[export_format], "application/octet-stream")
                    )
                    
                    st.success(f"✅ {export_format} file prepared for download!")
                    
                    # Show export stats if available
                    if hasattr(gdf, 'attrs') and 'join_stats' in gdf.attrs:
                        with st.expander("📊 Export Statistics"):
                            st.json(gdf.attrs['join_stats'])
                
            except Exception as e:
                st.error(f"Error exporting data: {e}")
        else:
            st.error("Please enter a filename.")

if __name__ == "__main__":
    main()