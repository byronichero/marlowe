"""Enrich graph nodes with assessment data from Postgres."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Assessment, RequirementAssessment
from app.schemas.graph import GraphNode, GraphResponse


async def enrich_graph_with_assessments(
    response: GraphResponse,
    db: AsyncSession,
    framework_id: int,
    assessment_id: int | None = None,
) -> GraphResponse:
    """
    Enrich requirement nodes with assessment status and maturity from Postgres.
    Uses the first assessment for the framework if assessment_id is not provided.
    """
    # Resolve assessment
    if assessment_id is not None:
        result = await db.execute(
            select(Assessment).where(
                Assessment.id == assessment_id,
                Assessment.framework_id == framework_id,
            )
        )
        assessment = result.scalar_one_or_none()
    else:
        result = await db.execute(
            select(Assessment)
            .where(Assessment.framework_id == framework_id)
            .order_by(Assessment.id.desc())
            .limit(1)
        )
        assessment = result.scalar_one_or_none()

    if assessment is None:
        return response

    # Fetch requirement assessments for this assessment
    ra_result = await db.execute(
        select(RequirementAssessment)
        .where(RequirementAssessment.assessment_id == assessment.id)
        .options(selectinload(RequirementAssessment.requirement))
    )
    requirement_assessments = list(ra_result.scalars().unique().all())

    # Build lookup: requirement_id -> {status, maturity_score}
    ra_by_req: dict[int, dict] = {}
    for ra in requirement_assessments:
        ra_by_req[ra.requirement_id] = {
            "status": ra.status,
            "maturity_score": ra.maturity_score,
        }

    # Enrich requirement nodes
    prefix = "requirement_"
    enriched_nodes: list[GraphNode] = []
    for node in response.nodes:
        if (
            (node.type or "").lower() == "requirement"
            and node.id.startswith(prefix)
        ):
            try:
                req_id = int(node.id[len(prefix) :])
            except ValueError:
                enriched_nodes.append(node)
                continue

            data = ra_by_req.get(req_id)
            if data:
                props = dict(node.properties) if node.properties else {}
                props["status"] = data["status"]
                props["maturity_score"] = data["maturity_score"]
                enriched_nodes.append(
                    GraphNode(
                        id=node.id,
                        label=node.label,
                        type=node.type,
                        properties=props,
                    )
                )
            else:
                enriched_nodes.append(node)
        else:
            enriched_nodes.append(node)

    return GraphResponse(nodes=enriched_nodes, edges=response.edges)
