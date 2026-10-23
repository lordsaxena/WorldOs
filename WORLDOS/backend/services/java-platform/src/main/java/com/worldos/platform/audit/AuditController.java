package com.worldos.platform.audit;

import com.worldos.platform.workflow.WorkflowService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {
    private final WorkflowService workflowService;

    public AuditController(WorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    @GetMapping
    public List<AuditEvent> getAuditEvents() {
        return workflowService.findAuditEvents();
    }
}