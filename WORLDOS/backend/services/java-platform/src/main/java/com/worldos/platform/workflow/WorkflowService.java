package com.worldos.platform.workflow;

import com.worldos.platform.audit.AuditEvent;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

@Service
public class WorkflowService {
    private final Map<String, Workflow> workflows = new ConcurrentHashMap<>();
    private final ConcurrentLinkedDeque<AuditEvent> auditEvents =
        new ConcurrentLinkedDeque<>();

    public Workflow create(String name, String description) {
        Workflow workflow = new Workflow(
            UUID.randomUUID().toString(),
            name,
            description == null ? "" : description,
            "ACTIVE",
            Instant.now()
        );

        workflows.put(workflow.id(), workflow);

        auditEvents.addFirst(new AuditEvent(
            UUID.randomUUID().toString(),
            "WORKFLOW_CREATED",
            workflow.id(),
            "Created workflow: " + workflow.name(),
            Instant.now()
        ));

        while (auditEvents.size() > 500) {
            auditEvents.pollLast();
        }

        return workflow;
    }

    public List<Workflow> findAll() {
        return workflows.values().stream()
            .sorted(Comparator.comparing(Workflow::createdAt).reversed())
            .toList();
    }

    public Workflow findById(String id) {
        return workflows.get(id);
    }

    public List<AuditEvent> findAuditEvents() {
        return List.copyOf(auditEvents);
    }
}