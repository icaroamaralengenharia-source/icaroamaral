# Reset seguro da demonstração

O smoke cria todo o estado transacional em um diretório temporário e o remove ao terminar. Portanto, repetir o comando abaixo inicia uma demonstração limpa:

```powershell
Set-Location C:\elo-pilot-rc\backend
npm.cmd run pilot-demo-smoke
```

O reset não toca banco live, Supabase, sessão do navegador, `pm clear`, dados pessoais ou produção. Não usar `Remove-Item` em diretórios fora do worktree piloto para resetar a demonstração.
