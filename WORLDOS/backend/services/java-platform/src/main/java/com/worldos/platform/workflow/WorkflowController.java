package com.worldos.platform.workflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workflows")
public class WorkflowController {
    private final WorkflowService workflowService;

    public WorkflowController(WorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    public record CreateWorkflowRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 1000) String description
    ) {}

    @GetMapping
    public List<Workflow> getWorkflows() {
        return workflowService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Workflow createWorkflow(
        @Valid @RequestBody CreateWorkflowRequest request
    ) {
        return workflowService.create(
            request.name(),
            request.description()
        );
    }

    @GetMapping("/{id}")
    public Workflow getWorkflow(@PathVariable String id) {
        Workflow workflow = workflowService.findById(id);

        if (workflow == null) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Workflow not found"
            );
        }

        return workflow;
    }
}