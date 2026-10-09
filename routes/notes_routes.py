from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models import Note, User
from schemas import NoteCreate, NoteUpdate, NoteResponse
from auth import get_current_user

router = APIRouter(prefix="/api/notes", tags=["Notes"])


@router.get("/", response_model=List[NoteResponse])
def get_notes(
    search: Optional[str] = Query(None, description="Search term for title, content or tags"),
    tag: Optional[str] = Query(None, description="Filter notes by tag"),
    pinned_only: Optional[bool] = Query(False, description="Filter pinned notes only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Note).filter(Note.owner_id == current_user.id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Note.title.ilike(search_pattern),
                Note.content.ilike(search_pattern),
                Note.tags.ilike(search_pattern)
            )
        )

    if tag:
        tag_pattern = f"%{tag.strip()}%"
        query = query.filter(Note.tags.ilike(tag_pattern))

    if pinned_only:
        query = query.filter(Note.is_pinned == True)

    notes = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc()).all()
    return notes


@router.get("/tags", response_model=List[str])
def get_user_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notes = db.query(Note.tags).filter(Note.owner_id == current_user.id).all()
    tag_set = set()
    for (tag_str,) in notes:
        if tag_str:
            for t in tag_str.split(","):
                cleaned = t.strip()
                if cleaned:
                    tag_set.add(cleaned)
    return sorted(list(tag_set))


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    note_data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_note = Note(
        title=note_data.title,
        content=note_data.content,
        tags=note_data.tags or "",
        is_pinned=note_data.is_pinned or False,
        owner_id=current_user.id
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note


@router.get("/{note_id}", response_model=NoteResponse)
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    return note


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    note_data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    update_dict = note_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    db.delete(note)
    db.commit()
    return None
