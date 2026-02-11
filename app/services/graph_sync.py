"""Sync Postgres frameworks and requirements to Neo4j for the knowledge graph."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.graph_service import get_neo4j_driver

logger = logging.getLogger(__name__)


def _framework_id(framework_id: int) -> str:
    """Stable Neo4j node id for a framework (used for MERGE)."""
    return f"framework_{framework_id}"


def _requirement_id(requirement_id: int) -> str:
    """Stable Neo4j node id for a requirement (used for MERGE)."""
    return f"requirement_{requirement_id}"


async def sync_framework_to_neo4j(
    framework_id: int,
    name: str,
    slug: str,
    description: str | None = None,
    region: str | None = None,
    framework_type: str | None = None,
) -> None:
    """Create or update a Framework node in Neo4j."""
    driver = get_neo4j_driver()
    try:
        async with driver.session() as session:
            await session.run(
                """
                MERGE (f:Framework {id: $id})
                SET f.name = $name, f.slug = $slug,
                    f.description = $description, f.region = $region, f.framework_type = $framework_type
                """,
                id=_framework_id(framework_id),
                name=name or "",
                slug=slug or "",
                description=description or "",
                region=region or "",
                framework_type=framework_type or "",
            )
    except Exception as e:
        logger.warning("Neo4j sync_framework failed for id=%s: %s", framework_id, e)
    finally:
        await driver.close()


async def sync_requirement_to_neo4j(
    requirement_id: int,
    framework_id: int,
    identifier: str,
    title: str,
    description: str | None = None,
    level: str | None = None,
    family: str | None = None,
) -> None:
    """Create or update a Requirement node in Neo4j and link BELONGS_TO framework."""
    driver = get_neo4j_driver()
    try:
        async with driver.session() as session:
            req_id = _requirement_id(requirement_id)
            fw_id = _framework_id(framework_id)
            await session.run(
                """
                MERGE (r:Requirement {id: $req_id})
                SET r.identifier = $identifier, r.title = $title, r.name = $title,
                    r.description = $description, r.level = $level, r.family = $family
                WITH r
                MERGE (f:Framework {id: $fw_id})
                MERGE (r)-[:BELONGS_TO]->(f)
                """,
                req_id=req_id,
                fw_id=fw_id,
                identifier=identifier or "",
                title=title or "",
                description=description or "",
                level=level or "",
                family=family or "",
            )
    except Exception as e:
        logger.warning("Neo4j sync_requirement failed for id=%s: %s", requirement_id, e)
    finally:
        await driver.close()


async def delete_framework_from_neo4j(framework_id: int) -> None:
    """Remove a framework and its requirement edges from Neo4j."""
    driver = get_neo4j_driver()
    try:
        async with driver.session() as session:
            fw_id = _framework_id(framework_id)
            await session.run(
                "MATCH (r:Requirement)-[:BELONGS_TO]->(f:Framework {id: $fw_id}) DETACH DELETE r",
                fw_id=fw_id,
            )
            await session.run("MATCH (f:Framework {id: $fw_id}) DETACH DELETE f", fw_id=fw_id)
    except Exception as e:
        logger.warning("Neo4j delete_framework failed for id=%s: %s", framework_id, e)
    finally:
        await driver.close()


async def delete_requirement_from_neo4j(requirement_id: int) -> None:
    """Remove a requirement node from Neo4j."""
    driver = get_neo4j_driver()
    try:
        async with driver.session() as session:
            await session.run(
                "MATCH (r:Requirement {id: $id}) DETACH DELETE r",
                id=_requirement_id(requirement_id),
            )
    except Exception as e:
        logger.warning("Neo4j delete_requirement failed for id=%s: %s", requirement_id, e)
    finally:
        await driver.close()


async def sync_all_frameworks_and_requirements(db: AsyncSession) -> dict[str, int]:
    """
    Sync all frameworks and requirements from Postgres to Neo4j (for initial load or refresh).
    db: AsyncSession from get_db().
    Returns counts { "frameworks": N, "requirements": N }.
    """
    from app.models import Framework, Requirement
    from sqlalchemy import select

    counts = {"frameworks": 0, "requirements": 0}
    result = await db.execute(select(Framework))
    for f in result.scalars().all():
        await sync_framework_to_neo4j(
            f.id, f.name, f.slug, f.description, f.region, f.framework_type
        )
        counts["frameworks"] += 1
    result = await db.execute(select(Requirement))
    for r in result.scalars().all():
        await sync_requirement_to_neo4j(
            r.id, r.framework_id, r.identifier, r.title, r.description, r.level, r.family
        )
        counts["requirements"] += 1
    return counts
