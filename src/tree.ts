import treeify from 'treeify'

class Tree {
  nodes: { [key: string]: Tree } = {}

  insert(child: string, value: Tree = new Tree()): Tree {
    this.nodes[child] = value
    return this
  }

  childSearch(key: string): Tree | undefined {
    const k = Object.keys(this.nodes).find((kk) => kk === key)
    return k ? this.nodes[k] : undefined
  }

  // progressiveChildSearch(keys: string[], tree = this): Tree | undefined {
  //   let cur: Tree | undefined = tree.childSearch(keys[0])
  //   if (!cur) return
  //   if (!keys[1]) return cur
  //   return cur.progressiveChildSearch(keys.slice(1, keys.length), cur)
  // }

  findOrInsert(child: string, value: Tree = new Tree()): Tree {
    const c = this.childSearch(child)
    if (c) return c
    this.insert(child, value)
    return this.childSearch(child) as Tree
  }

  // tslint:disable-next-line:no-console
  display(logger: any = console.log) {
    const addNodes = function (nodes: any) {
      const tree: { [key: string]: any } = {}
      for (const p of Object.keys(nodes)) {
        tree[p] = addNodes(nodes[p].nodes)
      }
      return tree
    }

    const tree = addNodes(this.nodes)
    logger(treeify.asTree(tree, true, true))
  }
}

export default class CommandTree extends Tree {
  findMostProgressiveCmd(id: string[]): [Tree | undefined, string[]] {
    let cur
    let next
    for (let i = 0; i < id.length; i++) {
      next = (next || this).nodes[id[i]]
      if (!next) return [cur, !i ? [] : id.slice(0, i)]
      cur = next
    }
    return [cur, id]
  }
}
