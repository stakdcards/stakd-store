# 🚀 GPU Acceleration Setup (Optional)

Speed up background removal from **3 seconds → 0.5 seconds** per image!

---

## ✅ **Requirements**

- NVIDIA GPU (GTX 1050 or newer recommended)
- Windows 10/11
- ~8GB free disk space for CUDA

---

## 📥 **Step 1: Install CUDA Toolkit**

1. **Check your GPU**
   ```bash
   nvidia-smi
   ```
   If this works, you have an NVIDIA GPU! Note the CUDA version.

2. **Download CUDA Toolkit 11.8**
   - Go to: https://developer.nvidia.com/cuda-11-8-0-download-archive
   - Select: Windows → x86_64 → 10/11 → exe (local)
   - Download (~3GB)
   - Run installer, select "Express Installation"

3. **Verify installation**
   ```bash
   nvcc --version
   ```
   Should show: `cuda_11.8`

---

## 🔧 **Step 2: Install PyTorch with CUDA**

```bash
# Uninstall CPU-only version
pip uninstall torch torchvision torchaudio

# Install GPU version
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

---

## ✅ **Step 3: Verify GPU Support**

```bash
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')"
```

Should print:
```
CUDA available: True
GPU: NVIDIA GeForce RTX 3060
```

---

## 🎯 **Step 4: Test Background Removal**

Restart your backend:
```bash
python main.py
```

RemBG will automatically use GPU if available!

---

## 📊 **Performance Comparison**

| Hardware | Time per Image | Images/Hour |
|----------|---------------|-------------|
| CPU (i7) | 3 seconds | 1,200 |
| GPU (RTX 3060) | 0.5 seconds | **7,200** |
| GPU (RTX 4070) | 0.3 seconds | **12,000** |

---

## 🐛 **Troubleshooting**

### "CUDA out of memory"
- Process images one at a time
- Use smaller model (`u2netp`)
- Reduce image resolution

### GPU not being used
1. Check CUDA version matches PyTorch version
2. Restart Python/backend
3. Check `nvidia-smi` shows available memory

### Installation failed
- Make sure Visual Studio C++ redistributables are installed
- Restart computer after CUDA install
- Try CUDA 11.7 if 11.8 doesn't work

---

## 💡 **Tips**

- First GPU inference is slower (model compilation)
- Keep GPU drivers updated
- Monitor GPU temp with `nvidia-smi -l 1`
- GPU also speeds up color extraction!

---

## ℹ️ **Not Needed?**

CPU-only RemBG works great too! GPU is optional:
- CPU: Perfect for low-volume (< 100 cards/day)
- GPU: Better for high-volume (hundreds of cards/day)

The system works 100% free either way! 🎉
