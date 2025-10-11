"""Global chat router providing cross-meeting RAG capabilities."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..core import rag
from ..database import get_db

router = APIRouter(
    prefix="/global-chat",
    tags=["global-chat"],
)


@router.post("/sessions", response_model=schemas.GlobalChatSession)
def create_session(payload: schemas.GlobalChatSessionCreate, db: Session = Depends(get_db)):
    session = crud.create_global_chat_session(db, payload.title)
    return session


@router.get("/sessions", response_model=list[schemas.GlobalChatSession])
def list_sessions(db: Session = Depends(get_db)):
    return crud.list_global_chat_sessions(db)


@router.get("/sessions/{session_id}", response_model=schemas.GlobalChatSessionDetail)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = crud.get_global_chat_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = crud.get_global_chat_messages(db, session_id)
    return schemas.GlobalChatSessionDetail(session=session, messages=messages)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = crud.delete_global_chat_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted", "session_id": session_id}


@router.post("/sessions/{session_id}/messages", response_model=schemas.GlobalChatMessage)
async def send_message(
    session_id: int,
    payload: schemas.GlobalChatMessageCreate,
    db: Session = Depends(get_db),
):
    session = crud.get_global_chat_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    history = payload.chat_history
    if history is None:
        existing_messages = crud.get_global_chat_messages(db, session_id)
        history = [
            {"role": message.role, "content": message.content}
            for message in existing_messages[-6:]
        ]

    # Store the user message immediately for persistence
    crud.add_global_chat_message(db, session_id, role="user", content=payload.message)

    response_text, sources = await rag.generate_rag_response(
        db,
        query=payload.message,
        chat_history=history,
        top_k=5,
    )

    assistant_message = crud.add_global_chat_message(
        db,
        session_id,
        role="assistant",
        content=response_text,
        sources=sources,
    )
    return assistant_message

