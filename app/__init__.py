from fastapi import FastAPI


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title="Voice Support API",
        description="AI-powered customer support via voice",
        version="1.0.0",
    )

    # Register routes
    from app.routes.support import router as support_router

    app.include_router(support_router)

    return app
