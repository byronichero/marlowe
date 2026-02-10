"""Pydantic schemas for knowledge graph API."""

from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    """A node in the knowledge graph."""

    id: str = Field(..., description="Node identifier")
    label: str = Field(..., description="Display label")
    type: str = Field(..., description="Node type: framework, requirement, assessment")
    properties: dict = Field(default_factory=dict)


class GraphEdge(BaseModel):
    """An edge between two nodes."""

    source: str = Field(..., description="Source node id")
    target: str = Field(..., description="Target node id")
    type: str = Field(..., description="Relationship type: belongs_to, references, depends_on, etc.")


class GraphResponse(BaseModel):
    """Full graph for visualization."""

    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
