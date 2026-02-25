"""Neo4j graph service for knowledge graph – relationships between controls/requirements/frameworks."""

import logging
from datetime import datetime, timezone
from typing import Any

from neo4j import AsyncGraphDatabase

from app.core.config import settings
from app.schemas.graph import GraphEdge, GraphHealth, GraphNode, GraphResponse, GraphStats

logger = logging.getLogger(__name__)


def get_neo4j_driver():
    """Return async Neo4j driver (caller should close when app shuts down)."""
    return AsyncGraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
    )


async def get_graph(
    framework_id: int | None = None,
    fedramp_baseline: str | None = None,
) -> GraphResponse:
    """
    Query Neo4j for nodes (frameworks, requirements, assessments) and edges.
    Returns data suitable for knowledge-graph visualization.
    When framework_id and fedramp_baseline are set, filter to NIST controls in that baseline.
    """
    driver = get_neo4j_driver()
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    try:
        async with driver.session() as session:
            if framework_id is None:
                nodes, edges = await _build_full_graph(session)
            else:
                nodes, edges = await _build_framework_graph(
                    session, framework_id, fedramp_baseline=fedramp_baseline
                )
    except Exception as e:
        logger.warning("Neo4j get_graph failed: %s", e)
    finally:
        await driver.close()
    return GraphResponse(nodes=nodes, edges=edges)


async def _build_full_graph(session: Any) -> tuple[list[GraphNode], list[GraphEdge]]:
    """Return full graph nodes and edges."""
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    id_map: dict[str, str] = {}
    node_result = await session.run(
        """
        MATCH (n)
        RETURN elementId(n) AS neo4j_id, labels(n)[0] AS label,
               n.id AS custom_id, n.name AS name, n.identifier AS identifier
        """
    )
    async for record in node_result:
        neo4j_id = record["neo4j_id"] or ""
        custom_id = record["custom_id"]
        lbl = record["label"] or "node"
        name = record["name"] or record["identifier"] or custom_id or neo4j_id
        nid = str(custom_id) if custom_id else neo4j_id
        id_map[neo4j_id] = nid
        nodes.append(GraphNode(id=nid, label=str(name), type=lbl, properties={"name": name}))
    edge_result = await session.run(
        """
        MATCH (a)-[r]->(b)
        RETURN elementId(a) AS src, elementId(b) AS tgt, type(r) AS rel
        """
    )
    async for record in edge_result:
        src = id_map.get(record["src"], record["src"])
        tgt = id_map.get(record["tgt"], record["tgt"])
        if src and tgt:
            edges.append(
                GraphEdge(
                    source=src,
                    target=tgt,
                    type=record["rel"] or "references",
                )
            )
    return nodes, edges


async def _build_framework_graph(
    session: Any,
    framework_id: int,
    fedramp_baseline: str | None = None,
) -> tuple[list[GraphNode], list[GraphEdge]]:
    """Return framework-only graph nodes and edges. Optionally filter by FedRAMP baseline."""
    from app.data.fedramp_baselines import get_baseline_control_ids

    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    id_map: dict[str, str] = {}
    control_ids = get_baseline_control_ids(fedramp_baseline) if fedramp_baseline else []

    if control_ids:
        # Filter requirements to baseline controls only
        node_result = await session.run(
            """
            MATCH (f:Framework {id: $fw_id})
            MATCH (r:Requirement)-[:BELONGS_TO]->(f)
            WHERE r.identifier IN $control_ids
            WITH f, collect(r) AS reqs
            UNWIND [f] + reqs AS n
            RETURN elementId(n) AS neo4j_id, labels(n)[0] AS label,
                   n.id AS custom_id, n.name AS name, n.identifier AS identifier
            """,
            fw_id=f"framework_{framework_id}",
            control_ids=control_ids,
        )
    else:
        node_result = await session.run(
            """
            MATCH (f:Framework {id: $fw_id})
            OPTIONAL MATCH (r:Requirement)-[:BELONGS_TO]->(f)
            WITH f, collect(r) AS reqs
            UNWIND [f] + [x IN reqs WHERE x IS NOT NULL] AS n
            RETURN elementId(n) AS neo4j_id, labels(n)[0] AS label,
                   n.id AS custom_id, n.name AS name, n.identifier AS identifier
            """,
            fw_id=f"framework_{framework_id}",
        )
    seen_nids: set[str] = set()
    async for record in node_result:
        neo4j_id = record["neo4j_id"] or ""
        custom_id = record["custom_id"]
        lbl = record["label"] or "node"
        name = record["name"] or record["identifier"] or custom_id or neo4j_id
        nid = str(custom_id) if custom_id else neo4j_id
        if nid in seen_nids:
            continue
        seen_nids.add(nid)
        id_map[neo4j_id] = nid
        nodes.append(GraphNode(id=nid, label=str(name), type=lbl, properties={"name": name}))
    if control_ids:
        edge_result = await session.run(
            """
            MATCH (r:Requirement)-[rel:BELONGS_TO]->(f:Framework {id: $fw_id})
            WHERE r.identifier IN $control_ids
            RETURN elementId(r) AS src, elementId(f) AS tgt, type(rel) AS rel
            """,
            fw_id=f"framework_{framework_id}",
            control_ids=control_ids,
        )
    else:
        edge_result = await session.run(
            """
            MATCH (r:Requirement)-[rel:BELONGS_TO]->(f:Framework {id: $fw_id})
            RETURN elementId(r) AS src, elementId(f) AS tgt, type(rel) AS rel
            """,
            fw_id=f"framework_{framework_id}",
        )
    async for record in edge_result:
        src = id_map.get(record["src"], record["src"])
        tgt = id_map.get(record["tgt"], record["tgt"])
        if src and tgt:
            edges.append(
                GraphEdge(
                    source=src,
                    target=tgt,
                    type=record["rel"] or "references",
                )
            )
    # Include Evidence nodes and EVIDENCES edges for this framework
    if control_ids:
        ev_node_result = await session.run(
            """
            MATCH (e:Evidence)-[:EVIDENCES]->(r:Requirement)-[:BELONGS_TO]->(f:Framework {id: $fw_id})
            WHERE r.identifier IN $control_ids
            RETURN elementId(e) AS neo4j_id, labels(e)[0] AS label,
                   e.id AS custom_id, e.name AS name, e.identifier AS identifier
            """,
            fw_id=f"framework_{framework_id}",
            control_ids=control_ids,
        )
        ev_edge_result = await session.run(
            """
            MATCH (e:Evidence)-[rel:EVIDENCES]->(r:Requirement)-[:BELONGS_TO]->(f:Framework {id: $fw_id})
            WHERE r.identifier IN $control_ids
            RETURN elementId(e) AS src, elementId(r) AS tgt, type(rel) AS rel
            """,
            fw_id=f"framework_{framework_id}",
            control_ids=control_ids,
        )
    else:
        ev_node_result = await session.run(
            """
            MATCH (e:Evidence)-[:EVIDENCES]->(r:Requirement)-[:BELONGS_TO]->(f:Framework {id: $fw_id})
            RETURN elementId(e) AS neo4j_id, labels(e)[0] AS label,
                   e.id AS custom_id, e.name AS name, e.identifier AS identifier
            """,
            fw_id=f"framework_{framework_id}",
        )
        ev_edge_result = await session.run(
            """
            MATCH (e:Evidence)-[rel:EVIDENCES]->(r:Requirement)-[:BELONGS_TO]->(f:Framework {id: $fw_id})
            RETURN elementId(e) AS src, elementId(r) AS tgt, type(rel) AS rel
            """,
            fw_id=f"framework_{framework_id}",
        )
    async for record in ev_node_result:
        neo4j_id = record["neo4j_id"] or ""
        custom_id = record["custom_id"]
        lbl = record["label"] or "Evidence"
        name = record["name"] or record["identifier"] or custom_id or neo4j_id
        nid = str(custom_id) if custom_id else neo4j_id
        if nid in seen_nids:
            continue
        seen_nids.add(nid)
        id_map[neo4j_id] = nid
        nodes.append(GraphNode(id=nid, label=str(name), type=lbl, properties={"name": name}))
    async for record in ev_edge_result:
        src = id_map.get(record["src"], record["src"])
        tgt = id_map.get(record["tgt"], record["tgt"])
        if src and tgt:
            edges.append(
                GraphEdge(
                    source=src,
                    target=tgt,
                    type=record["rel"] or "EVIDENCES",
                )
            )
    return nodes, edges


async def get_graph_stats(
    framework_id: int | None = None,
    fedramp_baseline: str | None = None,
) -> GraphStats:
    """Return aggregate graph statistics for UI telemetry cards."""
    driver = get_neo4j_driver()
    node_counts: dict[str, int] = {}
    total_nodes = 0
    total_relationships = 0
    try:
        async with driver.session() as session:
            if framework_id is None:
                node_counts, total_nodes = await _fetch_node_counts(session)
                total_relationships = await _fetch_relationship_count(session)
            else:
                node_counts, total_nodes = await _fetch_framework_node_counts(
                    session, framework_id, fedramp_baseline=fedramp_baseline
                )
                total_relationships = await _fetch_framework_relationship_count(
                    session, framework_id, fedramp_baseline=fedramp_baseline
                )
    except Exception as e:
        logger.warning("Neo4j get_graph_stats failed: %s", e)
    finally:
        await driver.close()

    framework_nodes = node_counts.get("framework", 0)
    requirement_nodes = node_counts.get("requirement", 0)
    assessment_nodes = node_counts.get("assessment", 0)
    evidence_nodes = node_counts.get("evidence", 0)
    avg_per_requirement = (
        total_relationships / requirement_nodes if requirement_nodes > 0 else 0.0
    )
    return GraphStats(
        total_nodes=total_nodes,
        total_relationships=total_relationships,
        framework_nodes=framework_nodes,
        requirement_nodes=requirement_nodes,
        assessment_nodes=assessment_nodes,
        evidence_nodes=evidence_nodes,
        avg_relationships_per_requirement=round(avg_per_requirement, 2),
    )


async def _fetch_node_counts(session: Any) -> tuple[dict[str, int], int]:
    node_counts: dict[str, int] = {}
    total_nodes = 0
    node_result = await session.run(
        """
        MATCH (n)
        RETURN labels(n)[0] AS label, count(n) AS count
        """
    )
    async for record in node_result:
        label = (record["label"] or "node").lower()
        count = int(record["count"] or 0)
        node_counts[label] = count
        total_nodes += count
    return node_counts, total_nodes


async def _fetch_framework_node_counts(
    session: Any,
    framework_id: int,
    fedramp_baseline: str | None = None,
) -> tuple[dict[str, int], int]:
    from app.data.fedramp_baselines import get_baseline_control_ids

    node_counts: dict[str, int] = {}
    total_nodes = 0
    control_ids = get_baseline_control_ids(fedramp_baseline) if fedramp_baseline else []
    if control_ids:
        node_result = await session.run(
            """
            MATCH (f:Framework {id: $fw_id})
            OPTIONAL MATCH (r:Requirement)-[:BELONGS_TO]->(f)
            WHERE r.identifier IN $control_ids
            WITH f, collect(r) AS reqs
            UNWIND [f] + [x IN reqs WHERE x IS NOT NULL] AS n
            WITH labels(n)[0] AS lbl
            RETURN lbl AS label, count(*) AS count
            """,
            fw_id=f"framework_{framework_id}",
            control_ids=control_ids,
        )
    else:
        node_result = await session.run(
            """
            MATCH (f:Framework {id: $fw_id})
            OPTIONAL MATCH (r:Requirement)-[:BELONGS_TO]->(f)
            WITH f, collect(r) AS reqs
            UNWIND [f] + [x IN reqs WHERE x IS NOT NULL] AS n
            WITH labels(n)[0] AS lbl
            RETURN lbl AS label, count(*) AS count
            """,
            fw_id=f"framework_{framework_id}",
        )
    async for record in node_result:
        label = (record["label"] or "node").lower()
        count = int(record["count"] or 0)
        node_counts[label] = count
        total_nodes += count
    return node_counts, total_nodes


async def _fetch_relationship_count(session: Any) -> int:
    rel_result = await session.run("MATCH ()-[r]->() RETURN count(r) AS count")
    rel_record = await rel_result.single()
    return int(rel_record["count"] or 0) if rel_record else 0


async def _fetch_framework_relationship_count(
    session: Any, framework_id: int, fedramp_baseline: str | None = None
) -> int:
    from app.data.fedramp_baselines import get_baseline_control_ids

    control_ids = get_baseline_control_ids(fedramp_baseline) if fedramp_baseline else []
    if control_ids:
        rel_result = await session.run(
            """
            MATCH (r:Requirement)-[rel:BELONGS_TO]->(f:Framework {id: $fw_id})
            WHERE r.identifier IN $control_ids
            RETURN count(rel) AS count
            """,
            fw_id=f"framework_{framework_id}",
            control_ids=control_ids,
        )
    else:
        rel_result = await session.run(
            """
            MATCH (r:Requirement)-[rel:BELONGS_TO]->(f:Framework {id: $fw_id})
            RETURN count(rel) AS count
            """,
            fw_id=f"framework_{framework_id}",
        )
    rel_record = await rel_result.single()
    return int(rel_record["count"] or 0) if rel_record else 0


async def get_graph_health() -> GraphHealth:
    """Return Neo4j health status and version."""
    driver = get_neo4j_driver()
    status = "degraded"
    version = "unknown"
    try:
        async with driver.session() as session:
            result = await session.run(
                """
                CALL dbms.components()
                YIELD name, versions
                RETURN name, versions
                LIMIT 1
                """
            )
            record = await result.single()
            if record:
                status = "ok"
                versions = record.get("versions") or []
                version = versions[0] if versions else "unknown"
    except Exception as e:
        logger.warning("Neo4j get_graph_health failed: %s", e)
    finally:
        await driver.close()

    return GraphHealth(
        status=status,
        version=version,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


async def get_framework_names() -> list[str]:
    """Return framework names in the knowledge graph (for chat context)."""
    driver = get_neo4j_driver()
    names: list[str] = []
    try:
        async with driver.session() as session:
            result = await session.run(
                "MATCH (f:Framework) RETURN f.name AS name ORDER BY f.name"
            )
            async for record in result:
                name = record.get("name")
                if name:
                    names.append(str(name))
    except Exception as e:
        logger.warning("Neo4j get_framework_names failed: %s", e)
    finally:
        await driver.close()
    return names


async def ensure_indexes(driver: Any = None) -> None:
    """Create basic indexes if not present (optional, for performance)."""
    d = driver or get_neo4j_driver()
    try:
        async with d.session() as session:
            await session.run("CREATE INDEX framework_id IF NOT EXISTS FOR (f:Framework) ON (f.id)")
            await session.run("CREATE INDEX requirement_id IF NOT EXISTS FOR (r:Requirement) ON (r.id)")
            await session.run("CREATE INDEX evidence_id IF NOT EXISTS FOR (e:Evidence) ON (e.id)")
    except Exception as e:
        logger.warning("Neo4j ensure_indexes: %s", e)
    finally:
        if driver is None:
            await d.close()
