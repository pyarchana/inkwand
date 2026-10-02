import logging
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from app.config import SITE_NAME  # noqa: E402
from app.routes.api import router as api_router  # noqa: E402

logging.basicConfig(level=logging.INFO)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

app = FastAPI(title=SITE_NAME)
app.include_router(api_router)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def revalidate_pages(request: Request, call_next):
    # Make browsers check for a newer page, CSS or JS on every visit. Unchanged
    # files still come back as a tiny 304, so slow connections don't pay for it,
    # but a redeploy shows up straight away instead of serving a stale stylesheet.
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path == "/favicon.svg" or path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


@app.exception_handler(RequestValidationError)
async def friendly_validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Please pick a book and a chapter, or write a topic (2 to 150 characters)."},
    )


@app.get("/", include_in_schema=False)
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/favicon.svg", include_in_schema=False)
async def favicon():
    return FileResponse(STATIC_DIR / "favicon.svg", media_type="image/svg+xml")
