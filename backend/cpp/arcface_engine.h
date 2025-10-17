#pragma once
#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>
#include <string>
#include <vector>
#include <iostream>

class ArcFaceEngine {
private:
    cv::dnn::Net net;
    bool initialized = false;
    std::string activeBackend = "CPU";   // Store which backend is used
    std::string activeTarget = "CPU";    // Store which target (CPU/GPU)

public:
    // Load the ONNX model and automatically pick the best backend (GPU if available)
    bool loadModel(const std::string& path);

    // Get 512-D face embedding (normalized)
    std::vector<float> getEmbedding(const cv::Mat& face);

    // Utility: check if model is loaded
    inline bool isInitialized() const { return initialized; }

    // Utility: print backend info
    void printBackendInfo() const;

    // Utility: get backend name (for logs/UI)
    inline std::string getBackend() const { return activeBackend; }
    inline std::string getTarget() const { return activeTarget; }
};