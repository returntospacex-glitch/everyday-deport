---
description: Changes를 GitHub에 커밋하고 푸시하는 방법
---

이 워크플로우는 현재 변경 사항을 스테이징하고, 커밋 메시지와 함께 로컬 레포지토리에 저장한 후 원격 GitHub 레포지토리로 푸시하는 과정을 안내합니다.

### 1. 변경 사항 확인
먼저 어떤 파일들이 수정되었는지 확인합니다.
```powershell
git status
```

### 2. 모든 변경 사항 스테이징
수정된 모든 파일을 커밋 대기 상태로 만듭니다.
```powershell
git add .
```

### 3. 변경 사항 커밋
작업 내용을 설명하는 메시지와 함께 커밋을 생성합니다.
// turbo
```powershell
git commit -m "feat: 식사 페이지 캘린더 추가 및 UI 폴리싱 완료"
```

### 4. GitHub로 푸시
로컬의 커밋을 원격 서버로 전송합니다.
// turbo
```powershell
git push origin main
```

> [!TIP]
> 만약 브랜치 이름이 `master`라면 `git push origin master`를 사용하세요.
