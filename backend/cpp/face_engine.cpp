#include <iostream>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
#include <opencv2/opencv.hpp>
#include "arcface_engine.h"  // Only ArcFace now

using json = nlohmann::json;

static ArcFaceEngine arcface;

// Initialize only once
static bool initialized = false;

static void init_models() {
    if (initialized) return;

    std::string arc_path = "cpp/models/arcface_r100.onnx";
    bool arc_ok = arcface.loadModel(arc_path);

    if (arc_ok)
        std::cout << "✅ ArcFace model initialized successfully.\n";
    else
        std::cerr << "❌ ArcFace model initialization failed.\n";

    initialized = true;
}

// =====================================================
// Exported Function: detect_and_embed
// =====================================================
// This version assumes the frontend (Blaze) already sends a CROPPED face image.
extern "C" const char* detect_and_embed(const char* image_path) {
    static std::string result_str;
    init_models();

    try {
        cv::Mat img = cv::imread(image_path);
        if (img.empty()) {
            std::cerr << "❌ Cannot read image: " << image_path << std::endl;
            result_str = "[]";
            return result_str.c_str();
        }

        // 🔹 Since Blaze already detects faces, treat the whole image as one face
        std::vector<float> embedding = arcface.getEmbedding(img);

        json output = json::array();
        if (!embedding.empty()) {
            output.push_back({
                {"embedding", embedding},
                {"facial_area", {
                    {"x", 0},
                    {"y", 0},
                    {"w", img.cols},
                    {"h", img.rows}
                }}
            });
        } else {
            std::cerr << "⚠️ ArcFace returned empty embedding for image.\n";
        }

        result_str = output.dump();
        return result_str.c_str();
    }
    catch (const std::exception& e) {
        std::cerr << "⚠️ Exception in detect_and_embed: " << e.what() << std::endl;
        result_str = "[]";
        return result_str.c_str();
    }
}