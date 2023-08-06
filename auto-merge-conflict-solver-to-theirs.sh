#!/bin/bash

# checkout the main branch
git checkout main

# loop over all branches
for branch in $(git branch -r | grep -v HEAD); do
  echo "Merging branch $branch"

  # attempt to merge
  git merge --no-commit --no-ff $branch

  # if there was a merge conflict, resolve it using the remote version
  if [ $? -ne 0 ]; then
    echo "Conflict detected, using remote version"
    git checkout --theirs .
    git add .
    git commit -m "Merged $branch, resolved conflicts by using remote version"
  else
    echo "Merge completed successfully"
    git commit -m "Merged $branch"
  fi
done
