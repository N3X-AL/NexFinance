# Project Rules & Workflow Instructions

## Branch and Pull Request Workflow
Whenever requested to add a feature, fix a bug, or make any edits/modifications in this project:

1. **Branch Creation**:
   - Do **not** commit directly to `main`.
   - Always ensure the working tree is clean and synced with `origin/main`.
   - Create and switch to a descriptive topic branch before modifying files (e.g., `feature/<descriptive-name>`, `fix/<descriptive-name>`, or `edit/<descriptive-name>`).

2. **Implement & Verify**:
   - Make the required changes on the newly created branch.
   - Test and verify the changes.

3. **Commit & Push**:
   - Commit the changes with clear, concise, and standard commit messages.
   - Push the branch to the remote repository:
     ```bash
     git push -u origin <branch-name>
     ```

4. **Pull Request (PR) Creation**:
   - Open a Pull Request targeting `main` using the GitHub CLI (`gh`):
     ```bash
     gh pr create --title "<PR Title>" --body "<Summary of changes and context>" --base main
     ```
   - Provide the user with the PR link and a concise summary of the changes made.
