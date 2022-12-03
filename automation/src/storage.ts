var fs = require('fs');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const fileExists = util.promisify(fs.exists);
const fileRename = util.promisify(fs.rename);
const fileRemove = util.promisify(fs.unlink);


export class Storage{
  toSave:any
  saving:boolean
  _name:string

  constructor(name:string){
    this.toSave=null
    this.saving=false
    this._saveChack=this._saveChack.bind(this)
    this._name=name

    if (!fs.existsSync("storage")){
      fs.mkdirSync("storage");
    }   
  }
  async load(){
    if (!(await fileExists(`storage/${this._name}.json`))){
      if (await fileExists(`storage/${this._name}_tmp.json`)){
        await fileRename(`storage/${this._name}_tmp.json`,`storage/${this._name}.json`)
      }else{
        return undefined
      }
    }
    var data = await readFile(`storage/${this._name}.json`,'utf8')
    return JSON.parse(data)
  }
  async _doSave(toSave:any){
    console.log(`saving ${this._name} ...`)
    await writeFile(`storage/${this._name}_tmp.json`,JSON.stringify(toSave))
    if (await fileExists(`storage/${this._name}.json`)){
      await fileRemove(`storage/${this._name}.json`)
    }
    await fileRename(`storage/${this._name}_tmp.json`,`storage/${this._name}.json`)
    console.log(`saving ${this._name} done`)
  }
  async _saveChack(){
    if (this.toSave===null || this.saving){
      return Promise.resolve()
    }
    this.saving=true
    let ret = this._doSave(this.toSave)
    ret.then( ()=>{
      this.saving=false
      setImmediate(this._saveChack)
    })
    this.toSave=null
    return ret
  }
  async save(to_save:any){
    this.toSave=to_save
    return this._saveChack()
  }
}