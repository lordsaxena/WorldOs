package com.worldos.platform.audit;

import java.time.Instant;

public record AuditEvent(String id, String action, String resource, String details, Instant createdAt) {}
