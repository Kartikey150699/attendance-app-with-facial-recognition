#include "arcface_engine.h"
#include <iostream>
#include <cmath>
#include <opencv2/core/utils/logger.hpp>

bool ArcFaceEngine::loadModel(const std::string& path) {
    try {
        // Suppress OpenCV warnings
        cv::utils::logging::setLogLevel(cv::utils::logging::LOG_LEVEL_SILENT);

        net = cv::dnn::readNetFromONNX(path);
        if (net.empty()) {
            std::cerr << "❌ Failed to load ArcFace model: " << path << std::endl;
            return false;
        }

        bool gpuEnabled = false;

#if defined(_WIN32)
        // Windows: try DirectML
        try {
            net.setPreferableBackend(cv::dnn::DNN_BACKEND_DML);
            net.setPreferableTarget(cv::dnn::DNN_TARGET_DML);
            activeBackend = "DirectML";
            activeTarget = "GPU";
            std::cout << "✅ Using DirectML GPU backend (Windows)" << std::endl;
            gpuEnabled = true;
        } catch (...) {
            std::cout << "⚠️ DirectML not available, fallback next." << std::endl;
        }
#endif

#ifdef HAVE_CUDA
        if (!gpuEnabled) {
            try {
                net.setPreferableBackend(cv::dnn::DNN_BACKEND_CUDA);
                net.setPreferableTarget(cv::dnn::DNN_TARGET_CUDA);
                activeBackend = "CUDA";
                activeTarget = "GPU";
                std::cout << "✅ Using CUDA GPU backend (NVIDIA)" << std::endl;
                gpuEnabled = true;
            } catch (...) {
                std::cout << "⚠️ CUDA backend not available, fallback next." << std::endl;
            }
        }
#endif

#ifdef __APPLE__
        if (!gpuEnabled) {
            try {
                net.setPreferableBackend(cv::dnn::DNN_BACKEND_DEFAULT);
                net.setPreferableTarget(cv::dnn::DNN_TARGET_OPENCL_FP16);
                activeBackend = "Metal/OpenCL FP16";
                activeTarget = "GPU";
                std::cout << "✅ Using macOS Metal GPU (OpenCL FP16)" << std::endl;
                gpuEnabled = true;
            } catch (...) {
                std::cout << "⚠️ Metal GPU not available, fallback next." << std::endl;
            }
        }
#endif

        // Try generic OpenCL GPU (Linux/Windows if supported)
        if (!gpuEnabled) {
            try {
                net.setPreferableBackend(cv::dnn::DNN_BACKEND_DEFAULT);
                net.setPreferableTarget(cv::dnn::DNN_TARGET_OPENCL_FP16);
                activeBackend = "OpenCL FP16";
                activeTarget = "GPU";
                std::cout << "✅ Using generic OpenCL FP16 GPU backend" << std::endl;
                gpuEnabled = true;
            } catch (...) {
                std::cout << "⚠️ OpenCL not available, fallback to CPU." << std::endl;
            }
        }

        // CPU fallback
        if (!gpuEnabled) {
            net.setPreferableBackend(cv::dnn::DNN_BACKEND_DEFAULT);
            net.setPreferableTarget(cv::dnn::DNN_TARGET_CPU);
            activeBackend = "Default";
            activeTarget = "CPU";
            std::cout << "💻 Using CPU backend (no GPU detected)" << std::endl;
        }

        initialized = true;
        std::cout << "✅ ArcFace model initialized successfully from: " << path << std::endl;

        // Print backend summary
        printBackendInfo();
        return true;
    }
    catch (const cv::Exception& e) {
        std::cerr << "⚠️ ArcFace load error: " << e.what() << std::endl;
        return false;
    }
}

std::vector<float> ArcFaceEngine::getEmbedding(const cv::Mat& face) {
    std::vector<float> embedding(512, 0.0f);
    if (!initialized) {
        std::cerr << "⚠️ ArcFace not initialized!" << std::endl;
        return embedding;
    }

    try {
        cv::Mat resized;
        cv::resize(face, resized, cv::Size(112, 112));
        resized.convertTo(resized, CV_32F, 1.0 / 255.0);

        cv::Mat blob = cv::dnn::blobFromImage(
            resized, 1.0, cv::Size(112, 112),
            cv::Scalar(0, 0, 0), true, false
        );

        net.setInput(blob);
        cv::Mat output = net.forward();

        for (int i = 0; i < output.cols; ++i)
            embedding[i] = output.at<float>(0, i);

        // Normalize
        float norm = 0.0f;
        for (float v : embedding) norm += v * v;
        norm = std::sqrt(norm) + 1e-6f;
        for (float& v : embedding) v /= norm;
    }
    catch (const std::exception& e) {
        std::cerr << "⚠️ ArcFace forward error: " << e.what() << std::endl;
    }

    return embedding;
}

void ArcFaceEngine::printBackendInfo() const {
    std::cout << "----------------------------------------\n";
    std::cout << "🧠 ArcFace Engine Backend Info\n";
    std::cout << "   Backend : " << activeBackend << "\n";
    std::cout << "   Target  : " << activeTarget << "\n";
    std::cout << "----------------------------------------\n";
}