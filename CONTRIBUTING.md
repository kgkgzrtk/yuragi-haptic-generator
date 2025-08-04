# Contributing to Yuragi Haptic Generator

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub flow, so all code changes happen through pull requests.

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/yuragi-haptic-generator.git
cd yuragi-haptic-generator

# Run the setup script
./setup-dev.sh

# Or manually:
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e ".[dev,test]"

# Frontend setup with pnpm
cd frontend
pnpm install
cd ..
```

## Code Style

- We use [Black](https://github.com/psf/black) for Python code formatting
- Line length is 88 characters
- We use type hints where possible
- Follow PEP 8 guidelines

### Running Code Quality Checks

```bash
# Format code
uv run black backend/src backend/tests

# Check code style
uv run flake8 backend/src

# Type checking
uv run mypy backend/src

# All checks (if Makefile is available)
make lint
```

## Testing

We follow Test-Driven Development (TDD) practices:

1. Write tests first
2. Make tests pass
3. Refactor

### Running Tests

```bash
# Run all tests
uv run pytest backend/tests -v

# Run with coverage
uv run pytest backend/tests --cov=haptic_system --cov-report=html

# Run specific test file
uv run pytest backend/tests/unit/test_waveform.py -v

# Run only unit tests
uv run pytest backend/tests/unit -v

# Run only integration tests
uv run pytest backend/tests/integration -v
```

### Writing Tests

- Place unit tests in `backend/tests/unit/`
- Place integration tests in `backend/tests/integration/`
- Use descriptive test names that explain what is being tested
- Follow the Arrange-Act-Assert pattern
- Aim for >90% test coverage

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:
```
Add sawtooth wave phase offset calculation

- Implement correct phase offset formula
- Add comprehensive unit tests
- Update documentation

Fixes #123
```

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the docs/ with any new functionality
3. The PR will be merged once you have the sign-off of at least one maintainer

## Documentation

- Keep documentation up to date with code changes
- Use clear, concise language
- Include code examples where helpful
- Update API documentation for any interface changes

## Any contributions you make will be under the MIT License

When you submit code changes, your submissions are understood to be under the same [MIT License](LICENSE) that covers the project.

## Report bugs using GitHub's [issues](https://github.com/your-org/yuragi-haptic-generator/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/your-org/yuragi-haptic-generator/issues/new).

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## License

By contributing, you agree that your contributions will be licensed under its MIT License.

## Questions?

Feel free to open an issue with your question or contact the maintainers directly.