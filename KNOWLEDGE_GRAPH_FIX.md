# Knowledge Graph Fix & Changes for Roughneck Chat

This document describes changes made to fix the knowledge graph visualization. Use it when porting fixes back to the original **Roughneck Chat** project from which Genesis was cloned.

---

## Summary

The knowledge graph API was returning empty relationships due to a **FastAPI route ordering bug**. The fix involves reordering routes so `/knowledge-graph/*` endpoints are matched correctly before the parameterized `/{document_id}` routes.

---

## 1. Route Ordering Fix (Critical Bug)

### Problem

The endpoint `GET /api/documents/knowledge-graph/relationships` returned `{"relationships": []}` even when Neo4j had data. FastAPI was matching the path to `/{document_id}/relationships` with `document_id="knowledge-graph"`, which called `get_document_relationships("knowledge-graph")` instead of `get_all_knowledge_graph_relationships()`.

### File

`app/api/routes/documents.py`

### Solution

Define the knowledge-graph routes **before** the parameterized `/{document_id}` routes. FastAPI matches routes in order; the first match wins.

### Implementation

Add these two route definitions **immediately after** `@router.get("/", response_model=DocumentList)` and **before** `@router.get("/{document_id}", ...)`:

```python
@router.get("/knowledge-graph/summary")
async def get_knowledge_graph_summary():
    """Get summary statistics of the knowledge graph."""
    try:
        summary = await document_processor.knowledge_graph.get_knowledge_graph_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/knowledge-graph/relationships")
async def get_all_knowledge_graph_relationships():
    """Get all document relationships in one call for the visual graph (avoids N round-trips)."""
    try:
        relationships = await document_processor.knowledge_graph.get_all_relationships()
        return {"relationships": relationships}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Ensure there are no duplicate definitions of these routes elsewhere in the file.

---

## 2. Knowledge Graph `doc_id` (Already in Genesis)

The Cypher query in `get_all_relationships` must return `d.id as doc_id` so the frontend can draw edges from documents to concepts/entities. Genesis already has this. If Roughneck Chat does not:

- **Backend** (`app/services/knowledge_graph.py`): The `get_all_relationships` Cypher query must include `d.id as doc_id` in the RETURN clause.
- **Frontend** (`static/js/app.js`): The `renderVisualGraph` function must use `rel.doc_id` when creating edges (e.g. `const docId = rel.doc_id`).

---

## 3. Test Document (Optional)

For manual testing, a sample file `uploads/test_knowledge_graph.txt` with oil & gas domain content can be used to verify concept/entity extraction. This is optional and not required for the fix.

---

## 4. Files Modified

| File | Change |
|------|--------|
| `app/api/routes/documents.py` | Reordered routes so `/knowledge-graph/summary` and `/knowledge-graph/relationships` are defined before `/{document_id}` routes |

---

## 5. Verification Steps

1. Start the app and upload a document.
2. Call `GET /api/documents/knowledge-graph/relationships` — the response should include non-empty `relationships` with `doc_id` populated.
3. In the UI, go to the Knowledge Graph section and click **Show Visual Graph**.
4. Confirm documents are connected to concepts and entities.

---

## 6. Roughneck Chat Porting Checklist

When updating the original Roughneck Chat project:

- [ ] Apply the route ordering fix in `app/api/routes/documents.py`
- [ ] Verify `get_all_relationships` returns `doc_id` in the response
- [ ] Verify the frontend uses `rel.doc_id` for graph edges
- [ ] Restart the backend after making changes
- [ ] Test the knowledge graph visualization end-to-end
