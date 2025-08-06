# Refactoring Meta-Plan for Yuragi Haptic Generator

## Goal
Complete refactoring, ensure all tests pass, and push the changes to the repository.

## Dependency Graph

```
Candidate 1 (Remove Deprecated Streaming)
         │
         ├──► Candidate 2 (Unify Logging Output)
         │           ├──► Candidate 4 (Improve Error Handling)
         │           └──► Candidate 5 (Split Long Methods)
         │
         ├──► Candidate 3 (Improve TS Type Definitions)
         │
         ├──► Candidate 6 (Unify Import Statements)
         │
         ├──► Candidate 7 (Fix HTML Classes)
         │
         └──► Candidate 8 (Resolve TODO Comments)

All merge to base, then:
         └──► Candidate 9 (Refactor Nested Test Code)
```

## Phase 1: Environment Setup (30 minutes)

### Tasks
1. Create `refactoring` base branch
2. Setup git worktrees for parallel work
3. Verify all tests pass on base branch

### Agent Assignment
- **git-worktree-manager**: Create and manage worktree structure
- **test-runner**: Validate base branch tests

### Worktree Structure
```
.worktrees/
├── streaming-removal/       # Candidate 1
├── logging-unification/     # Candidate 2
├── typescript-types/        # Candidate 3
├── error-handling/          # Candidate 4
├── method-splitting/        # Candidate 5
├── import-unification/      # Candidate 6
├── html-classes/           # Candidate 7
├── todo-resolution/        # Candidate 8
└── test-refactoring/       # Candidate 9
```

## Phase 2: High Priority Root Task (1 day)

### Candidate 1: Remove Deprecated Streaming
**Branch**: `refactor/remove-streaming`
**Dependencies**: None

#### Tasks
1. Remove backend streaming code
   - `controller.py`: is_streaming, start_streaming(), stop_streaming()
   - `main.py`: /api/streaming/*, background_waveform_streamer()
2. Remove frontend streaming code
   - `useStreamingQuery.ts` (entire file)
   - `zustandQuerySync.ts`: handleStreamingError
   - `streaming-controls.spec.ts`
3. Update imports and references
4. Update documentation

#### Agent Assignment
- **task-decomposer**: Break down removal tasks
- **task-executor**: Execute code removal
- **test-runner**: Validate no breakage
- **code-reviewer**: Review changes

## Phase 3: First Parallel Batch (2 days)

### Candidate 2: Unify Logging Output
**Branch**: `refactor/unify-logging`
**Dependencies**: Candidate 1 merged

#### Tasks
1. Backend: Replace 7 print statements with logger
2. Frontend: Replace 8 console.* with logger.ts
3. Configure logging levels

#### Agent Assignment
- **task-executor**: Replace logging statements
- **test-runner**: Validate logging behavior
- **code-reviewer**: Check consistency

### Candidate 3: Improve TypeScript Types
**Branch**: `refactor/typescript-types`
**Dependencies**: Candidate 1 merged

#### Tasks
1. Define error types (APIError, WebSocketError)
2. Replace 5+ any types
3. Enable ESLint rules

#### Agent Assignment
- **task-executor**: Type improvements
- **test-runner**: Type checking
- **code-reviewer**: Type safety review

### Candidate 6: Unify Import Statements
**Branch**: `refactor/unify-imports`
**Dependencies**: Candidate 1 merged

#### Tasks
1. Standardize to @/ absolute imports
2. Configure ESLint import rules
3. Auto-fix all imports

#### Agent Assignment
- **task-executor**: Import standardization
- **test-runner**: Build verification

### Candidate 7: Fix HTML Class Duplicates
**Branch**: `refactor/html-classes`
**Dependencies**: Candidate 1 merged

#### Tasks
1. Fix DeviceWarningDialog.tsx duplicate className
2. Add clsx for conditional classes

#### Agent Assignment
- **task-executor**: HTML fixes
- **test-runner**: UI tests

### Candidate 8: Resolve TODO Comments
**Branch**: `refactor/todo-resolution`
**Dependencies**: Candidate 1 merged

#### Tasks
1. Integrate toast notification system
2. Document or defer other TODOs

#### Agent Assignment
- **task-executor**: TODO resolution
- **code-reviewer**: Validate solutions

## Phase 4: Second Parallel Batch (2 days)

### Candidate 4: Improve Error Handling
**Branch**: `refactor/error-handling`
**Dependencies**: Candidates 1, 2 merged

#### Tasks
1. Define custom exception classes
2. Implement error boundaries
3. Structure error responses

#### Agent Assignment
- **task-executor**: Error handling improvements
- **test-runner**: Error case testing
- **code-reviewer**: Defensive coding review

### Candidate 5: Split Long Methods
**Branch**: `refactor/method-splitting`
**Dependencies**: Candidates 1, 2, 3 merged

#### Tasks
1. Split controller._detect_audio_device() (63 lines)
2. Extract device detection logic

#### Agent Assignment
- **task-decomposer**: Identify split points
- **task-executor**: Method extraction
- **test-runner**: Logic preservation
- **code-reviewer**: Refactoring review

## Phase 5: Final Cleanup (1 day)

### Candidate 9: Refactor Nested Test Code
**Branch**: `refactor/test-cleanup`
**Dependencies**: Candidates 1-8 merged

#### Tasks
1. Extract helper functions in error-handling.spec.ts
2. Enhance test utilities

#### Agent Assignment
- **task-executor**: Test refactoring
- **test-runner**: Test suite validation
- **code-reviewer**: Test quality review

## Phase 6: Integration & Validation (1 day)

### Tasks
1. Merge all branches to refactoring branch
2. Run full test suite
3. Performance benchmarks
4. Security audit
5. Final code review
6. Push to main repository

### Agent Assignment
- **git-worktree-manager**: Merge coordination
- **test-runner**: Full test suite
- **code-reviewer**: Final review
- **devops-problem-solver**: CI/CD validation

## Success Criteria

- [ ] All refactoring candidates implemented
- [ ] All tests passing (unit, integration, E2E)
- [ ] No TypeScript errors
- [ ] No ESLint violations
- [ ] Code coverage maintained or improved
- [ ] Performance benchmarks stable
- [ ] Security audit passed
- [ ] Final O3 approval received

## Risk Mitigation

1. **Incremental Changes**: Each branch contains focused changes
2. **Continuous Testing**: Tests run after each merge
3. **Code Reviews**: Every change reviewed before merge
4. **Rollback Strategy**: Git worktrees allow easy rollback
5. **Parallel Validation**: Multiple agents validate changes

## Timeline

- Phase 1: 30 minutes
- Phase 2: 1 day
- Phase 3: 2 days (parallel)
- Phase 4: 2 days (parallel)
- Phase 5: 1 day
- Phase 6: 1 day

**Total**: ~6 days with parallel execution

## Communication Protocol

1. Each agent reports progress via structured messages
2. Blocking issues escalated to devops-problem-solver
3. Daily status aggregation
4. Final O3 review before completion