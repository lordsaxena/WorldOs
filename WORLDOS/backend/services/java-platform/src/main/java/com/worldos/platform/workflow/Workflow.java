package com.worldos.platform.workflow;

import java.time.Instant;

public record Workflow(String id, String name, String description, String status, Instant createdAt) {}
