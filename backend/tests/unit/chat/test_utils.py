"""Unit tests for `app.chat.utils`."""

from beanie import PydanticObjectId

from app.chat.models import ChatMessageDocument
from app.chat.schemas import FileReference, GraphReference
from app.chat.utils import to_message_response


class TestToMessageResponse:
    """Turn a stored message into its API response."""

    @staticmethod
    def _message(sources: list[dict[str, str]] | None) -> ChatMessageDocument:
        """Build a stored assistant message carrying `sources`."""
        message = ChatMessageDocument(
            thread_id=PydanticObjectId(),
            role="ai",
            content="Answer.",
            sources=sources,
        )
        message.id = PydanticObjectId()
        return message

    def test_keeps_a_file_reference(self) -> None:
        """A file source serializes as a file reference."""
        message = self._message(
            [{"kind": "file", "path": "src/main.py", "file_id": "aaa"}]
        )

        response = to_message_response(message, None)

        assert response.sources == [FileReference(path="src/main.py", file_id="aaa")]

    def test_keeps_a_graph_reference_whole(self) -> None:
        """A graph point survives with the scope and node it was cited at."""
        message = self._message(
            [
                {
                    "kind": "graph",
                    "path": "src/Foo.java",
                    "file_id": "aaa",
                    "graph_type": "cfg",
                    "scope": "method:com.acme.Foo#run():void",
                    "node": "7",
                }
            ]
        )

        response = to_message_response(message, None)

        assert response.sources == [
            GraphReference(
                path="src/Foo.java",
                file_id="aaa",
                graph_type="cfg",
                scope="method:com.acme.Foo#run():void",
                node="7",
            )
        ]

    def test_without_sources(self) -> None:
        """A message that cited nothing carries no sources field."""
        response = to_message_response(self._message(None), None)

        assert response.sources is None
