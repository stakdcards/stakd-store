#!/usr/bin/env python3
"""
Test script specifically for athlete photo edge quality.
Compares different models and edge refinement options.
"""

import time
import os
from PIL import Image
from rembg import remove, new_session

# Test image - replace with your athlete photo
TEST_IMAGE = "../frontend/public/jordan.jpg"

def test_configuration(input_image, config_name, model_name, refine=False, athlete_enhance=False):
    """Test a specific configuration"""
    from main import refine_edges, enhance_edges_for_athletes
    
    print(f"\n{'='*60}")
    print(f"Testing: {config_name}")
    print(f"{'='*60}")
    
    try:
        # Load model
        print(f"Loading model: {model_name}...")
        session = new_session(model_name)
        
        # Process image
        start = time.time()
        output = remove(input_image, session=session)
        remove_time = time.time() - start
        print(f"✅ Background removed in {remove_time:.2f}s")
        
        # Apply edge refinement if requested
        if athlete_enhance:
            start = time.time()
            output = enhance_edges_for_athletes(output)
            enhance_time = time.time() - start
            print(f"✅ Athlete enhancement applied in {enhance_time:.2f}s")
        elif refine:
            start = time.time()
            output = refine_edges(output)
            refine_time = time.time() - start
            print(f"✅ Edge refinement applied in {refine_time:.2f}s")
        
        # Save result
        output_path = f"test_{config_name.replace(' ', '_').lower()}.png"
        output.save(output_path)
        file_size = os.path.getsize(output_path) / 1024
        print(f"✅ Saved to {output_path} ({file_size:.1f} KB)")
        
        return {
            'config': config_name,
            'time': remove_time + (enhance_time if athlete_enhance else (refine_time if refine else 0)),
            'output': output_path,
            'success': True
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {'config': config_name, 'success': False, 'error': str(e)}

def main():
    print("\n" + "="*60)
    print("🏃 Athlete Photo Edge Quality Test")
    print("="*60)
    
    if not os.path.exists(TEST_IMAGE):
        print(f"\n❌ Test image not found: {TEST_IMAGE}")
        return
    
    print(f"\nLoading test image: {TEST_IMAGE}")
    input_image = Image.open(TEST_IMAGE)
    print(f"✅ Image loaded: {input_image.size[0]}x{input_image.size[1]} pixels")
    
    # Test configurations
    configs = [
        ("Basic - u2net_human_seg", "u2net_human_seg", False, False),
        ("u2net_human_seg + Refinement", "u2net_human_seg", True, False),
        ("isnet + Standard Refinement", "isnet-general-use", True, False),
        ("isnet + Athlete Enhancement ⭐", "isnet-general-use", False, True),
        ("silueta + Athlete Enhancement", "silueta", False, True),
    ]
    
    results = []
    for config_name, model, refine, enhance in configs:
        result = test_configuration(input_image, config_name, model, refine, enhance)
        results.append(result)
        time.sleep(1)
    
    # Print summary
    print("\n" + "="*60)
    print("📊 EDGE QUALITY COMPARISON")
    print("="*60)
    
    successful = [r for r in results if r['success']]
    if successful:
        print("\n✅ Test Results:")
        print(f"\n{'Configuration':<40} {'Time':<10}")
        print("-" * 50)
        for r in successful:
            print(f"{r['config']:<40} {r['time']:>6.2f}s")
        
        print("\n" + "="*60)
        print("📸 Compare the output images to see edge quality!")
        print("="*60)
        print("\nLook for:")
        print("  ✓ Smooth edges (not jagged)")
        print("  ✓ Clean hair details")
        print("  ✓ Crisp limb boundaries")
        print("  ✓ No halos or artifacts")
        print("\nRecommended: 'isnet + Athlete Enhancement ⭐'")
    
    print()

if __name__ == "__main__":
    main()
