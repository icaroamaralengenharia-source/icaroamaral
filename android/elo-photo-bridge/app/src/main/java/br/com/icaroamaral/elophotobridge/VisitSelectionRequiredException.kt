package br.com.icaroamaral.elophotobridge

class VisitSelectionRequiredException(
  val command: ParsedCommand,
  val groups: List<VisitGroup>
) : Exception("multiple_visits")
