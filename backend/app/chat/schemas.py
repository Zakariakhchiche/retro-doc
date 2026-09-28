"""Chat Pydantic schemas.

This module defines the schemas for the chat endpoints (e.g., Data Transfer Object - DTO).
"""

from datetime import datetime
from typing import Annotated, Literal

from beanie import PydanticObjectId
from pydantic import BaseModel, Field

from app.chat.config import chat_settings


class ChatContext(BaseModel):
    username: str | None


class CreateChatRequest(BaseModel):
    repo_id: PydanticObjectId
    message: str


class ChatMessageRequest(BaseModel):
    message: str


class ChatThreadResponse(BaseModel):
    chat_id: PydanticObjectId
    repo_id: PydanticObjectId
    title: str
    created_at: datetime
    updated_at: datetime


class ChatThreadListResponse(BaseModel):
    threads: list[ChatThreadResponse]


class ChatMessageResponse(BaseModel):
    """A stored chat message as returned by the API.

    The variant fields are populated only for an assistant message that has
    been regenerated, so an unbranched thread's payload is unchanged.
    """

    id: PydanticObjectId
    role: str
    content: str

    sources: list["ChatReference"] | None = None
    """The files and graph points the answer drew on, in the order cited."""

    variant_index: int | None = None
    """The 1-based position of this answer among its siblings."""

    variant_count: int | None = None
    prev_variant_id: PydanticObjectId | None = None
    next_variant_id: PydanticObjectId | None = None


class ChatThreadMessagesResponse(BaseModel):
    chat_id: PydanticObjectId
    messages: list[ChatMessageResponse]
    next_cursor: PydanticObjectId | None = None


class FileReference(BaseModel):
    kind: Literal["file"] = "file"
    path: str
    file_id: str


class GraphReference(BaseModel):
    """A point in a code analysis graph an answer drew on.

    `scope` names one CFG/DFG of the file, which are stored one per scope
    (usually a function): it is unused for an AST, which has a single graph per file.
    `node` addresses a single node inside it: the builder's numeric id for a CFG or
    DFG, or a label for an AST, whose nodes carry no ids of their own.
    """

    kind: Literal["graph"] = "graph"
    path: str
    file_id: str
    graph_type: Literal["ast", "cfg", "dfg"]
    scope: str | None = None
    node: str | None = None


class RetryMessageRequest(BaseModel):
    message_id: PydanticObjectId


class SelectVariantRequest(BaseModel):
    message_id: PydanticObjectId


class UpdateChatTitleRequest(BaseModel):
    title: str = Field(min_length=1, max_length=chat_settings.TITLE_MAX_LEN)


ChatReference = Annotated[FileReference | GraphReference, Field(discriminator="kind")]
