# Refactoring Execution Plan with Agent Assignments

## Current Status
- Meta-plan created and reviewed by O3
- Task dependencies optimized for parallel execution
- Ready to begin Phase 1

## Agent Assignment Matrix

| Phase | Task | Primary Agent | Supporting Agents | Duration |
|-------|------|--------------|-------------------|----------|
| 1 | Environment Setup | git-worktree-manager | test-runner | 30 min |
| 2 | Remove Streaming | task-executor | task-decomposer, test-runner, code-reviewer | 1 day |
| 3A | Logging Unification | task-executor | test-runner, code-reviewer | Parallel 2 days |
| 3B | TypeScript Types | task-executor | test-runner, code-reviewer | Parallel 2 days |
| 3C | Import Unification | task-executor | test-runner | Parallel 2 days |
| 3D | HTML Classes | task-executor | test-runner | Parallel 2 days |
| 3E | TODO Resolution | task-executor | code-reviewer | Parallel 2 days |
| 4A | Error Handling | task-executor | test-runner, code-reviewer | Parallel 2 days |
| 4B | Method Splitting | task-decomposer + task-executor | test-runner, code-reviewer | Parallel 2 days |
| 5 | Test Refactoring | task-executor | test-runner, code-reviewer | 1 day |
| 6 | Integration | git-worktree-manager | test-runner, code-reviewer, devops-problem-solver | 1 day |

## Execution Commands

### Phase 1: Environment Setup
```bash
# Create refactoring base branch
git checkout -b refactoring

# Setup worktree structure
mkdir -p .worktrees
git worktree add .worktrees/streaming-removal -b refactor/remove-streaming
git worktree add .worktrees/logging-unification -b refactor/unify-logging
git worktree add .worktrees/typescript-types -b refactor/typescript-types
git worktree add .worktrees/error-handling -b refactor/error-handling
git worktree add .worktrees/method-splitting -b refactor/method-splitting
git worktree add .worktrees/import-unification -b refactor/unify-imports
git worktree add .worktrees/html-classes -b refactor/html-classes
git worktree add .worktrees/todo-resolution -b refactor/todo-resolution
git worktree add .worktrees/test-refactoring -b refactor/test-cleanup

# Run tests on base branch
cd yuragi-haptic-generator
pnpm test:all
```

### Phase 2: Streaming Removal
```bash
cd .worktrees/streaming-removal
# Backend removal
rm backend/src/hooks/queries/useStreamingQuery.ts
# Update imports and remove streaming code
# Frontend removal
rm frontend/tests/e2e/streaming-controls.spec.ts
# Run tests
pnpm test:all
```

### Phase 3: Parallel Tasks
Each task runs in its own worktree simultaneously:
- Logging: Replace print/console statements
- TypeScript: Define types, remove any
- Imports: Standardize to @/ paths
- HTML: Fix duplicate className
- TODOs: Resolve or document

### Phase 4: Dependent Tasks
After Phase 3 merges:
- Error Handling: Custom exceptions, boundaries
- Method Splitting: Refactor long methods

### Phase 5: Test Cleanup
After all code changes:
- Refactor nested test code
- Extract helper functions

### Phase 6: Integration
- Merge all branches
- Full test suite
- Final review
- Push to main

## Progress Tracking

- [ ] Phase 1: Environment ready
- [ ] Phase 2: Streaming removed
- [ ] Phase 3: 5 parallel tasks complete
- [ ] Phase 4: 2 dependent tasks complete
- [ ] Phase 5: Tests refactored
- [ ] Phase 6: Integrated and pushed
- [ ] O3 final approval

## Next Steps
1. Execute Phase 1 with git-worktree-manager
2. Begin Phase 2 streaming removal
3. Launch Phase 3 parallel tasks
4. Monitor progress and handle blockers
5. Continue through phases until completion