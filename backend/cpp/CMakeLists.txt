cmake_minimum_required(VERSION 3.10)
project(face_engine LANGUAGES CXX)

# =========================================================
# ✅ Compiler setup
# =========================================================
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# ---------------------------------------------------------
# ✅ Detect OS
# ---------------------------------------------------------
if(WIN32)
    message(STATUS "🪟 Detected platform: Windows")
elseif(APPLE)
    message(STATUS "🍎 Detected platform: macOS")
elseif(UNIX)
    message(STATUS "🐧 Detected platform: Linux")
endif()

# =========================================================
# ✅ Dependencies
# =========================================================
find_package(OpenCV REQUIRED)

# Optional: CUDA support if OpenCV built with CUDA
find_package(CUDA QUIET)

# ---------------------------------------------------------
# ✅ nlohmann/json include
# ---------------------------------------------------------
find_path(NLOHMANN_JSON_INCLUDE_DIR nlohmann/json.hpp
    PATHS
        /opt/homebrew/include
        /usr/local/include
        /opt/homebrew/Cellar/nlohmann-json/3.12.0/include
        /usr/include
)

# =========================================================
# ✅ Include directories
# =========================================================
include_directories(
    ${OpenCV_INCLUDE_DIRS}
    ${NLOHMANN_JSON_INCLUDE_DIR}
    ${CMAKE_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/include
    /opt/homebrew/include
    /opt/homebrew/Cellar/opencv/4.12.0_12/include/opencv4
)

# =========================================================
# ✅ Source files
# =========================================================
set(SOURCES
    face_engine.cpp
    arcface_engine.cpp
    cosine_engine.cpp
    vector_match.cpp
)

# =========================================================
# ✅ Build shared library
# =========================================================
add_library(face_engine SHARED ${SOURCES})

# =========================================================
# ✅ GPU / DNN backend flags (auto-detect)
# =========================================================

# macOS — OpenCL (Metal)
if(APPLE)
    add_definitions(-D__APPLE__)
    message(STATUS "⚙️ Enabling OpenCL/Metal backend for macOS")
endif()

# Linux — CUDA or OpenCL
if(UNIX AND NOT APPLE)
    if(CUDA_FOUND)
        add_definitions(-DHAVE_CUDA)
        message(STATUS "⚙️ CUDA found — GPU acceleration enabled")
    else()
        message(STATUS "⚙️ CUDA not found — CPU/OpenCL fallback")
    endif()
endif()

# Windows — DirectML backend
if(WIN32)
    add_definitions(-D_WIN32)
    message(STATUS "⚙️ Enabling DirectML GPU backend for Windows")
endif()

# =========================================================
# ✅ Link libraries
# =========================================================
target_link_libraries(face_engine
    ${OpenCV_LIBS}
)

# =========================================================
# ✅ Output settings
# =========================================================
set_target_properties(face_engine PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/build
    OUTPUT_NAME "face_engine"
)

# =========================================================
# ✅ Summary Message
# =========================================================
message(STATUS "✅ ArcFace-only build configured successfully!")
message(STATUS "🔹 OpenCV version: ${OpenCV_VERSION}")
if(CUDA_FOUND)
    message(STATUS "🔹 CUDA toolkit found: ${CUDA_VERSION}")
endif()
message(STATUS "🔹 Output library: ${CMAKE_SOURCE_DIR}/build/libface_engine")