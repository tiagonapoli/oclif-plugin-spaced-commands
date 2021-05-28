import * as Config from '@oclif/config'
import { CLIError } from '@oclif/errors'
import help from '@oclif/plugin-help'
import CommandHelp from '@oclif/plugin-help/lib/command'
import { renderList } from '@oclif/plugin-help/lib/list'
import { compact, sortBy } from '@oclif/plugin-help/lib/util'
import chalk from 'chalk'
import indent from 'indent-string'
import stripAnsi from 'strip-ansi'
import wrap from 'wrap-ansi'
import CommandTree from '../tree'

const { bold } = chalk

export const init: Config.Hook<'init'> = async function (ctx) {
  // build tree
  const cmds = [
    ...ctx.config.commandIDs,
    ...ctx.config.commands.reduce((acum, command) => {
      acum.push(...command.aliases)
      return acum
    }, []),
  ]

  const tree = new CommandTree()
  cmds.forEach((c) => {
    const bits = c.split(':')
    let cur = tree
    bits.forEach((b) => {
      cur = cur.findOrInsert(b) as CommandTree
    })
  })

  const id: string[] = (typeof ctx.id === 'string' ? [ctx.id] : (ctx.id! as any)) || []
  const RAWARGV = id.concat(ctx.argv || [])

  const convertName = function (cmdId: string[]): string {
    return cmdId.join(':')
  }

  const convertArgv = function (cmdId: string, old = process.argv) {
    const keys = cmdId.split(':')
    const argv = old.slice(keys.length + 2, old.length)
    return argv
  }

  // overwrite config.findCommand
  const { findCommand } = ctx.config
  function spacesFindCommand(_: string, __: { must: true }): Config.Command.Plugin
  function spacesFindCommand(_: string, __: { must: true }): Config.Command.Plugin | undefined {
    const [node, c] = tree.findMostProgressiveCmd(RAWARGV)
    // eslint-disable-next-line vtex/prefer-early-return
    if (node) {
      if (Object.keys((node as CommandTree).nodes).length) return
      return findCommand.apply(ctx.config, [convertName(c)])
    }
  }

  ctx.config.findCommand = spacesFindCommand

  // overwrite commandHelp.defaultUsage
  // @ts-ignore
  CommandHelp.prototype.defaultUsage = function (_: Config.Command.Flag[]): string {
    return compact([
      this.command.id.replaceAll(':', ' '),
      this.command.args
        .filter((a: any) => !a.hidden)
        .map((a: any) => this.arg(a))
        .join(' '),
      // flags.length && '[OPTIONS]',
    ]).join(' ')
  }

  // overwrite config.findTopic
  const { findTopic } = ctx.config
  function spacesFindTopic(_: string, __: { must: true }): Config.Topic
  function spacesFindTopic(_: string, __: { must: true }): Config.Topic | undefined {
    const [node, c] = tree.findMostProgressiveCmd(RAWARGV)
    if (node) {
      return findTopic.apply(ctx.config, [convertName(c)])
    }
  }

  ctx.config.findTopic = spacesFindTopic

  // overwrite config.runCommand
  ctx.config.runCommand = async (cmdId: string, argv: string[] = []) => {
    const originalId = cmdId
    // tslint:disable-next-line:no-unused
    const [_, name] = tree.findMostProgressiveCmd(RAWARGV)
    // override the id b/c of the closure
    cmdId = name.join(' ')
    argv = convertArgv(name!.join(':'))
    // don't need to pass ID b/c of the closure
    const c = ctx.config.findCommand('')
    if (!c) {
      await ctx.config.runHook('command_not_found', { id: cmdId })
      throw new CLIError(`command ${originalId} not found`)
    }
    const command = c.load()
    await ctx.config.runHook('prerun', { Command: command, argv })
    await command.run(argv, ctx.config)
  }

  // overwrite Help#formatCommands
  // @ts-ignore
  help.prototype.formatCommands = function (commands: Config.Command[]): string | undefined {
    if (commands.length === 0) return ''
    const body = renderList(
      commands.map((c) => [c.id.replace(/:/g, ' '), c.description && this.render(c.description.split('\n')[0])]),
      {
        spacer: '\n',
        stripAnsi: this.opts.stripAnsi,
        maxWidth: this.opts.maxWidth - 2,
      }
    )
    return [bold('COMMANDS'), indent(body, 2)].join('\n')
  }

  // overwrite Help#formatTopic
  // @ts-ignore
  help.prototype.formatTopic = function (topic: Config.Topic): string | undefined {
    let description = this.render(topic.description || '')
    const title = description.split('\n')[0]
    description = description.split('\n').slice(1).join('\n')
    let output = compact([
      title,
      [
        bold('USAGE'),
        indent(
          wrap(`$ ${this.config.bin} ${topic.name.replace(/:/g, ' ')} COMMAND`, this.opts.maxWidth - 2, { trim: false, hard: true }),
          2
        ),
      ].join('\n'),
      description && ([
        bold('DESCRIPTION'),
        indent(wrap(description, this.opts.maxWidth - 2, {trim: false, hard: true}), 2),
      ].join('\n')),
    ]).join('\n\n')
    if (this.opts.stripAnsi) output = stripAnsi(output)
    return output + '\n'
  }

  // overwrite Help#formatTopics
  // @ts-ignore
  help.prototype.formatTopics = function (topics: Config.Topic[]): string | undefined {
    if (topics.length === 0) return ''
    const body = renderList(
      topics.map((c) => [c.name.replace(/:/g, ' '), c.description && this.render(c.description.split('\n')[0])]),
      {
        spacer: '\n',
        stripAnsi: this.opts.stripAnsi,
        maxWidth: this.opts.maxWidth - 2,
      }
    )
    return [bold('TOPICS'), indent(body, 2)].join('\n')
  }

  // overwrite Help#topics
  help.prototype.topics = function (topics: Config.Topic[]): string | undefined {
    if (!topics.length) return
    const body = renderList(
      topics.map((c) => [c.name.replace(/:/g, ' '), c.description && this.render(c.description.split('\n')[0])]),
      {
        spacer: '\n',
        stripAnsi: this.opts.stripAnsi,
        maxWidth: this.opts.maxWidth - 2,
      }
    )
    return [bold('COMMANDS'), indent(body, 2)].join('\n')
  }

  // overwrite Help#topic
  help.prototype.topic = function (topic: Config.Topic): string {
    let description = this.render(topic.description || '')
    const title = description.split('\n')[0]
    description = description.split('\n').slice(1).join('\n')
    let output = compact([
      title,
      [
        bold('USAGE'),
        indent(
          wrap(`$ ${this.config.bin} ${topic.name.replace(/:/g, ' ')} COMMAND`, this.opts.maxWidth - 2, {
            trim: false,
            hard: true,
          }),
          2
        ),
      ].join('\n'),
      description &&
        [
          bold('DESCRIPTION'),
          indent(
            wrap(description, this.opts.maxWidth - 2, {
              trim: false,
              hard: true,
            }),
            2
          ),
        ].join('\n'),
    ]).join('\n\n')
    if (this.opts.stripAnsi) output = stripAnsi(output)
    return `${output}\n`
  }

  // overwrite commandHelp.generate
  CommandHelp.prototype.generate = function (): string {
    const cmd = this.command
    const flags = sortBy(
      Object.entries(cmd.flags || {})
        .filter(([, v]: [any, any]) => !v.hidden)
        .map(([k, v]: [any, any]) => {
          v.name = k
          return v
        }),
      (f: any) => [!f.char, f.char, f.name]
    )
    const args = (cmd.args || []).filter((a) => !a.hidden)
    let output = compact([
      this.usage(flags),
      this.args(args),
      this.flags(flags),
      this.description(),
      this.aliases(cmd.aliases.map((alias) => alias.replace(/:/g, ' '))),
      this.examples(cmd.examples || (cmd as any).example),
    ]).join('\n\n')
    if (this.opts.stripAnsi) output = stripAnsi(output)
    return output
  }
}
