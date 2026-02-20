const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .gguf files as asset extensions so Metro bundles them
config.resolver.assetExts.push('gguf');

// Optional: For Phase 2 (ONNX models for embeddings/STT/TTS)
// config.resolver.assetExts.push('onnx');

module.exports = config;
