#!/usr/bin/env python3
"""
Test script to verify background removal models work correctly.
Tests all available models and reports performance.
"""

import time
import os
from PIL import Image
from rembg import remove, new_session

# Test image path (you can change this to any image)
TEST_IMAGE = "../frontend/public/jordan.jpg"

MODELS = [
    'u2net',
    'u2netp', 
    'u2net_human_seg',
    'silueta',
    'isnet-general-use'
]

def test_model(model_name, input_image):
    """Test a single model and measure performance"""
    print(f"\n{'='*60}")
    print(f"Testing model: {model_name}")
    print(f"{'='*60}")
    
    try:
        # Load model
        start_load = time.time()
        print("Loading model...")
        session = new_session(model_name)
        load_time = time.time() - start_load
        print(f"✅ Model loaded in {load_time:.2f}s")
        
        # Process image
        start_process = time.time()
        print("Processing image...")
        output = remove(input_image, session=session)
        process_time = time.time() - start_process
        print(f"✅ Background removed in {process_time:.2f}s")
        
        # Save result
        output_path = f"test_output_{model_name}.png"
        output.save(output_path)
        file_size = os.path.getsize(output_path) / 1024  # KB
        print(f"✅ Saved to {output_path} ({file_size:.1f} KB)")
        
        return {
            'model': model_name,
            'load_time': load_time,
            'process_time': process_time,
            'total_time': load_time + process_time,
            'output_size': file_size,
            'success': True
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {
            'model': model_name,
            'success': False,
            'error': str(e)
        }

def main():
    print("\n" + "="*60)
    print("🎨 Background Removal Model Test Suite")
    print("="*60)
    
    # Check if test image exists
    if not os.path.exists(TEST_IMAGE):
        print(f"\n❌ Test image not found: {TEST_IMAGE}")
        print("Please update TEST_IMAGE path in the script")
        return
    
    # Load input image
    print(f"\nLoading test image: {TEST_IMAGE}")
    input_image = Image.open(TEST_IMAGE)
    print(f"✅ Image loaded: {input_image.size[0]}x{input_image.size[1]} pixels")
    
    # Test each model
    results = []
    for model_name in MODELS:
        result = test_model(model_name, input_image)
        results.append(result)
        time.sleep(1)  # Brief pause between tests
    
    # Print summary
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)
    
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    if successful:
        print("\n✅ Successful Models:")
        print(f"\n{'Model':<20} {'Load':<10} {'Process':<10} {'Total':<10}")
        print("-" * 50)
        for r in sorted(successful, key=lambda x: x['process_time']):
            print(f"{r['model']:<20} {r['load_time']:>6.2f}s   {r['process_time']:>6.2f}s   {r['total_time']:>6.2f}s")
        
        fastest = min(successful, key=lambda x: x['process_time'])
        print(f"\n🏆 Fastest: {fastest['model']} ({fastest['process_time']:.2f}s)")
    
    if failed:
        print("\n❌ Failed Models:")
        for r in failed:
            print(f"  - {r['model']}: {r.get('error', 'Unknown error')}")
    
    print("\n" + "="*60)
    print(f"✅ Test complete! {len(successful)}/{len(MODELS)} models working")
    print("="*60)
    
    # GPU check
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            print(f"\n🚀 GPU Detected: {gpu_name}")
            print("   Background removal will be MUCH faster!")
        else:
            print("\n💻 Running on CPU (GPU not detected)")
            print("   Install CUDA for 5-10x speedup (see INSTALL_GPU.md)")
    except ImportError:
        print("\n💻 Running on CPU")
    
    print()

if __name__ == "__main__":
    main()
