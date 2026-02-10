"""Neo4j graph service for knowledge graph – relationships between controls/requirements/frameworks."""

import logging
from typing import Any

from neo4j import AsyncGraphDatabase

from app.core.config import settings
from app.schemas.graph import GraphEdge, GraphNode, GraphResponse

logger = logging.getLogger(__name__)


def get_neo4j_driver():
    """Return async Neo4j driver (caller should close when app shuts down)."""
    return AsyncGraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
    )


async def get_graph() -> GraphResponse:
    """
    Query Neo4j for nodes (frameworks, requirements, assessments) and edges.
    Returns data suitable for knowledge-graph visualization.
    """
    driver = get_neo4j_driver()
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    try:
        async with driver.session() as session:
            # Query all nodes with label and props
            node_result = await session.run(
                """
                MATCH (n)
                RETURN elementId(n) AS id, labels(n)[0] AS label, n.name AS name, n.identifier AS identifier
                """
            )
            async for record in node_result:
                nid = record["id"] or ""
                lbl = record["label"] or "node"
                name = record["name"] or record["identifier"] or nid
                nodes.append(
                    GraphNode(id=nid, label=str(name), type=lbl, properties={"name": name})
                )
            # Query all relationships
            edge_result = await session.run(
                """
                MATCH (a)-[r]->(b)
                RETURN elementId(a) AS src, elementId(b) AS tgt, type(r) AS rel
                """
            )
            async for record in edge_result:
                edges.append(
                    GraphEdge(
                        source=record["src"],
                        target=record["tgt"],
                        type=record["rel"] or "references",
                    )
                )
    except Exception as e:
        logger.warning("Neo4j get_graph failed: %s", e)
    finally:
        await driver.close()
    return GraphResponse(nodes=nodes, edges=edges)


async def ensure_indexes(driver: Any = None) -> None:
    """Create basic indexes if not present (optional, for performance)."""
    d = driver or get_neo4j_driver()
    try:
        async with d.session() as session:
            await session.run("CREATE INDEX framework_id IF NOT EXISTS FOR (f:Framework) ON (f.id)")
            await session.run("CREATE INDEX requirement_id IF NOT EXISTS FOR (r:Requirement) ON (r.id)")
    except Exception as e:
        logger.warning("Neo4j ensure_indexes: %s", e)
    finally:
        if driver is None:
            await d.close()
