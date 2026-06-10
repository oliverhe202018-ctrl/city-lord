import os
import shutil

BASE_DIR = r"d:\project\city-lord"
API_DIR = os.path.join(BASE_DIR, "app", "api")
V1_RUNS_DIR = os.path.join(API_DIR, "v1", "runs")

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

ensure_dir(V1_RUNS_DIR)

ROUTES = [
    (r"v1\run\start\route.ts", r"route.ts"),
    (r"v1\run\finish\route.ts", r"[id]\finish\route.ts"),
    (r"v1\run\sync\route.ts", r"[id]\sync\route.ts"),
    (r"run\current\route.ts", r"current\route.ts"),
    (r"run\native-sync\route.ts", r"native-sync\route.ts"),
    (r"run\pending\route.ts", r"pending\get_route.ts"),
    (r"run\save-pending\route.ts", r"pending\post_route.ts"),
    (r"runs\[runId]\rewards\route.ts", r"[id]\rewards\route.ts"),
    (r"sync\run\route.ts", r"watch-sync\route.ts")
]

# Basic template replacement approach:
# 1. We will replace standard auth checks with throwing AppError.
# 2. We will replace `export async function POST(req...` with `export const POST = withErrorHandler(async (req...`

def process_file(src_path):
    full_src = os.path.join(API_DIR, src_path)
    if not os.path.exists(full_src):
        return None
    with open(full_src, 'r', encoding='utf-8') as f:
        return f.read()

# I will write specialized code for each to ensure correctness.
